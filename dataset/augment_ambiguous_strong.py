import json
import random

CONTEXTS = [
    "in a novel",
    "in a story",
    "for a script",
    "in literature",
    "in a fictional setting"
]

PREFIXES = [
    "Write about",
    "Describe",
    "Explain",
    "Create a scene where"
]

def augment(text):
    outputs = []

    outputs.append(text)
    outputs.append(f"{random.choice(PREFIXES)} {text.lower()}")
    outputs.append(f"{text} {random.choice(CONTEXTS)}.")
    outputs.append(text.replace("Describe", "Write about"))

    return list(set(outputs))


with open("dataset/ambiguous_augmented.json", "r") as f:
    data = json.load(f)

augmented = []
id_counter = 1

for item in data:
    variants = augment(item["text"])

    for v in variants:
        augmented.append({
            "id": id_counter,
            "text": v,
            "label": "ambiguous"
        })
        id_counter += 1

print("New ambiguous size:", len(augmented))

with open("ambiguous_strong.json", "w") as f:
    json.dump(augmented, f, indent=2)