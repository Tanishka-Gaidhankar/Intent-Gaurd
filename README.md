# Context-Aware Prompt Moderation System

## Overview

This project implements a **context-aware prompt moderation system** that classifies user prompts into three categories:

* **safe**
* **ambiguous**
* **nsfw**

The goal is to reduce **false positives** in traditional binary moderation systems while still reliably detecting explicit content. The system introduces an **intermediate “ambiguous” class** to capture borderline or uncertain prompts.

The model is based on **DistilBERT** and is deployed as a **REST API service** using FastAPI.

---

# System Architecture

User Prompt
↓
Moderation Model (DistilBERT)
↓
Classification

safe → allow
ambiguous → warn user
nsfw → block prompt

↓
API Response

---

# Dataset Construction

## 1. NSFW Dataset

Original dataset contained:

| Class | Samples |
| ----- | ------- |
| safe  | 117,000 |
| nsfw  | 70,000  |

To reduce computational cost and maintain class balance, a **subset was sampled**.

| Class | Samples Used |
| ----- | ------------ |
| safe  | 6000         |
| nsfw  | 6000         |

---

## 2. Ambiguous Dataset (Custom Generated)

A custom dataset was created to represent **borderline prompts** that may be interpreted differently depending on context.

Example prompts:

* “Write a romantic scene between two adults.”
* “Describe an intimate moment without explicit details.”

Total ambiguous samples used:

| Class     | Samples |
| --------- | ------- |
| ambiguous | 400     |

---

## Final Training Dataset

| Class     | Samples   |
| --------- | --------- |
| safe      | 6000      |
| ambiguous | 400       |
| nsfw      | 6000      |
| **Total** | **12400** |

---

# Dataset Split

The dataset was split using stratified sampling.

| Split      | Percentage |
| ---------- | ---------- |
| Train      | 70%        |
| Validation | 15%        |
| Test       | 15%        |

Total test samples: **1860**

---

# Model

Base Model: **distilbert-base-uncased**

Task: **3-class text classification**

Classes:

safe
ambiguous
nsfw

Training configuration:

* Epochs: 3
* Batch size: 8
* Max sequence length: 128
* Optimizer: AdamW
* Training device: CPU

---

# Evaluation Results

Test set performance:

Accuracy: **97%**

### Classification Report

| Class     | Precision | Recall | F1   |
| --------- | --------- | ------ | ---- |
| safe      | 0.98      | 0.96   | 0.97 |
| ambiguous | 1.00      | 1.00   | 1.00 |
| nsfw      | 0.96      | 0.98   | 0.97 |

### Confusion Matrix

```
[[861   0  39]
 [  0  60   0]
 [ 19   0 881]]
```

Observations:

* Low **safe → nsfw false positives (~4%)**
* High detection accuracy for explicit prompts
* Ambiguous prompts clearly separated from explicit content

---

# Moderation Policy Logic

The moderation system translates predictions into actions.

| Prediction | Decision | Action              |
| ---------- | -------- | ------------------- |
| safe       | allowed  | answer user         |
| ambiguous  | warn     | ask user to clarify |
| nsfw       | blocked  | refuse request      |

---

# API Service

The trained model is deployed as a **FastAPI service**.

Endpoint:

POST `/moderate`

Input format:

```
{
 "prompt": "user prompt text"
}
```

API Response format:

```
{
  "intent": "explicit_content",
  "decision": "blocked",
  "risk_level": "high",
  "explanation": "The prompt contains explicit or inappropriate content."
}
```

---

# Example Responses

### Safe Prompt

Input:

```
Explain how photosynthesis works
```

Response:

```
{
 "intent": "normal_query",
 "decision": "allowed",
 "risk_level": "low",
 "explanation": "The prompt does not violate content policies."
}
```

---

### Ambiguous Prompt

Input:

```
Write a romantic scene between two adults
```

Response:

```
{
 "intent": "uncertain_intent",
 "decision": "warn",
 "risk_level": "medium",
 "explanation": "The prompt may contain sensitive content."
}
```

---

### NSFW Prompt

Input:

```
Describe explicit sexual acts
```

Response:

```
{
 "intent": "explicit_content",
 "decision": "blocked",
 "risk_level": "high",
 "explanation": "The prompt contains explicit content."
}
```

---

# Project Structure

```
project/
│
├── dataset/
│   ├── ambiguous_augmented.json
│   └── final_training_dataset.json
│
├── train_distilbert.py
├── evaluate_model.py
├── api_service.py
│
├── distilbert_ambiguous_nsfw/
│   ├── model files
│
└── README.md
```

---


