from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import numpy as np
import uuid
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
import torch.nn.functional as F



app = FastAPI(title="Moderation API v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "distilbert_ambiguous_nsfw"

tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_PATH)
model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

id2label = {0: "safe", 1: "ambiguous", 2: "nsfw"}

# 🔐 Replace with DB later
VALID_API_KEYS = ["test123"]
bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


@app.get("/")
def root():
    return {
        "message": "Moderation API is running.",
        "endpoint": "/v1/moderate",
        "docs": "/docs"
    }


# -------- Request Schema --------
class ModerationRequest(BaseModel):
    model: str
    input: str


# -------- API Key Check --------
def check_api_key(auth_credentials, x_api_key):
    token = None

    if auth_credentials:
        token = auth_credentials.credentials.strip()
    elif x_api_key:
        token = x_api_key.strip()
    else:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Use 'Authorization: Bearer <api-key>' or 'X-API-Key: <api-key>'"
        )

    if token not in VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")



# -------- Flagged Words --------
def get_flagged_words(model_output, tokens_list):
    try:
        attentions = model_output.attentions[-1]
        attention_weights = attentions[0].mean(dim=0).detach().cpu().numpy()

        cls_attention = attention_weights[0]

        top_indices = np.argsort(cls_attention)[-5:][::-1]

        flagged_words = []
        for idx in top_indices:
            if idx < len(tokens_list):
                token = tokens_list[idx]
                if token.lower() not in ['[cls]', '[sep]', '[pad]']:
                    weight = float(cls_attention[idx])
                    if weight > 0.01:
                        flagged_words.append({
                            "word": token.strip(),
                            "importance_score": round(weight, 4)
                        })

        return flagged_words
    except:
        return []



def map_response(label, confidence, flagged_words):

    if label == "safe":
        return {
            "intent": "normal_query",
            "decision": "allowed",
            "risk_level": "low",
            "confidence_score": round(confidence, 4),
            "explanation": "The prompt does not violate content policies.",
            "flagged_words": flagged_words
        }

    elif label == "ambiguous":
        return {
            "intent": "uncertain_intent",
            "decision": "warn",
            "risk_level": "medium",
            "confidence_score": round(confidence, 4),
            "explanation": "The prompt may contain sensitive or suggestive content.",
            "flagged_words": flagged_words
        }

    else:
        return {
            "intent": "explicit_content",
            "decision": "blocked",
            "risk_level": "high",
            "confidence_score": round(confidence, 4),
            "explanation": "The prompt contains explicit or unsafe content.",
            "flagged_words": flagged_words
        }

def get_label_with_threshold(logits):
    """
    Threshold-based classification using calibrated per-class probability cutoffs.

    Priority order:
      1. NSFW   — if nsfw_p >= NSFW_THRESH
      2. Ambiguous — if amb_p >= AMB_THRESH and it leads both others
      3. Safe   — fallback

    Tune NSFW_THRESH and AMB_THRESH using evaluate_threshold.py /
    diagnose_misclassification.py on your held-out test set.
    """
    NSFW_THRESH = 0.65   # lower than 0.80 to catch more explicit prompts
    AMB_THRESH  = 0.30   # keep at 0.30 — model ambiguous class is small

    probs = F.softmax(logits, dim=1)[0].cpu().numpy()
    safe_p, amb_p, nsfw_p = float(probs[0]), float(probs[1]), float(probs[2])

    # 1. Strong NSFW signal wins first
    if nsfw_p >= NSFW_THRESH:
        return "nsfw", nsfw_p

    # 2. Ambiguous wins if it clearly leads
    if amb_p >= AMB_THRESH and amb_p > safe_p and amb_p > nsfw_p:
        return "ambiguous", amb_p

    # 3. Low overall confidence → flag as ambiguous rather than guessing
    max_prob = max(safe_p, amb_p, nsfw_p)
    if max_prob < 0.50:
        return "ambiguous", max_prob

    # 4. Default to safe
    return "safe", safe_p

# -------- Main Endpoint --------
@app.post("/v1/moderate")
def moderate(
    request: ModerationRequest,
    authorization: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    x_api_key: str | None = Security(api_key_scheme)
):

    # 🔐 API Key validation
    check_api_key(authorization, x_api_key)

    inputs = tokenizer(
        request.input,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=96
    )

    with torch.no_grad():
        outputs = model(**inputs, output_attentions=True)

    logits = outputs.logits
    label, confidence = get_label_with_threshold(logits)

    # Token extraction
    input_ids = inputs['input_ids'][0].cpu().numpy()
    tokens_list = [tokenizer.decode([tid]) for tid in input_ids]

    flagged_words = get_flagged_words(outputs, tokens_list)

    return {
        "id": f"mod-{uuid.uuid4()}",
        "model": request.model,
        "result": map_response(label, confidence, flagged_words)
    }
