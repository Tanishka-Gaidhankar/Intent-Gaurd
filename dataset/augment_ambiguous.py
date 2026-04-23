import json
import random
import copy

CONTEXT_PHRASES = [
    "in a fictional story",
    "in a novel",
    "for a narrative",
    "in a literary context",
    "as part of a story",
    "in a fictional setting"
]

PARAPHRASE_PREFIXES = [
    "Write about",
    "Describe",
    "Create a scene showing",
    "Portray",
    "Write a short passage about"
]

def augment_text(text):
    variants = []

    # Variant 1: prefix paraphrase
    prefix = random.choice(PARAPHRASE_PREFIXES)
    variants.append(f"{prefix} {text.lower()}")

    # Variant 2: context injection
    context = random.choice(CONTEXT_PHRASES)
    variants.append(f"{text} {context}.")

    # Variant 3: softened wording
    variants.append(text.replace("Describe", "Write about"))

    return variants


with open("ambi.json", "r") as f:
    data = json.load(f)

# Flatten nested lists and filter for dicts only
flattened_data = []
for item in data:
    if isinstance(item, dict):
        flattened_data.append(item)
    elif isinstance(item, list):
        flattened_data.extend(item)

data = flattened_data

augmented = []
new_id = max(item["id"] for item in data) + 1

for item in data:
    augmented.append(item)

    variants = augment_text(item["text"])
    for v in variants:
        new_item = copy.deepcopy(item)
        new_item["id"] = new_id
        new_item["text"] = v
        new_item["source"] = "augmentation"
        augmented.append(new_item)
        new_id += 1

with open("ambiguous_augmented.json", "w") as f:
    json.dump(augmented, f, indent=2)

print(f"Generated {len(augmented)} ambiguous samples.")
