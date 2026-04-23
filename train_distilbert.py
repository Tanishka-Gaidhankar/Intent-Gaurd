import os
os.environ["USE_TF"] = "0"          # tell Transformers: skip TensorFlow entirely
os.environ["USE_KERAS_2"] = "1"     # suppress Keras 3 compatibility check

import torch
import numpy as np
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments
)
from load_dataset import load_json_dataset
from sklearn.metrics import accuracy_score, f1_score
from torch.nn import CrossEntropyLoss

# -------- Load data --------
train_ds = load_json_dataset("train.json")
val_ds   = load_json_dataset("val.json")
test_ds  = load_json_dataset("test.json")

# -------- Tokenizer --------

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels", None)
        if labels is None:
            labels = inputs.pop("label", None)

        outputs = model(**inputs)

        logits = outputs.get("logits")

        weights = torch.tensor([1.0, 6.0, 1.2]).to(logits.device)  # ambiguous boosted: 400 vs 6000 samples
        loss_fn = CrossEntropyLoss(weight=weights)

        loss = loss_fn(logits, labels)

        return (loss, outputs) if return_outputs else loss

tokenizer = DistilBertTokenizerFast.from_pretrained(
    "distilbert-base-uncased"
)

def tokenize(batch):
    return tokenizer(
        batch["text"],
        padding="max_length",
        truncation=True,
        max_length=96
    )

train_ds = train_ds.map(tokenize, batched=True, remove_columns=["text"])
val_ds   = val_ds.map(tokenize, batched=True, remove_columns=["text"])
test_ds  = test_ds.map(tokenize, batched=True, remove_columns=["text"])

train_ds = train_ds.rename_column("label", "labels")
val_ds   = val_ds.rename_column("label", "labels")
test_ds  = test_ds.rename_column("label", "labels")

train_ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
val_ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
test_ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])

# -------- Model --------
model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=3,
    id2label={0: "safe", 1: "ambiguous", 2: "nsfw"},
    label2id={"safe": 0, "ambiguous": 1, "nsfw": 2}
)

# -------- Compute metrics --------
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=1)
    accuracy = accuracy_score(labels, predictions)
    f1 = f1_score(labels, predictions, average='weighted')
    return {"accuracy": accuracy, "f1": f1}

# -------- Training args --------
training_args = TrainingArguments(
    output_dir="./results",
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=8,   
    per_device_eval_batch_size=8,
    num_train_epochs=4,              
    weight_decay=0.01,
    logging_steps=100,
    load_best_model_at_end=True,
    metric_for_best_model="f1",      
    greater_is_better=True,
    save_total_limit=2
)

# -------- Trainer --------
trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics
)

# -------- Train --------
trainer.train()

# -------- Save --------
trainer.save_model("distilbert_ambiguous_nsfw")
tokenizer.save_pretrained("distilbert_ambiguous_nsfw")
