import json
import random

SAFE_TARGET = 6000
NSFW_TARGET = 6000

with open("good.json", "r") as f:
    data = json.load(f)
    # nsfw_dataset.json is a dict mapping, extract it as list or use directly
    nsfw_raw = data if isinstance(data, list) else [{"text": str(v), "labels": 1} for v in data.values()]

with open("ambiguous_augmented.json", "r") as f:
    ambiguous = json.load(f)

safe_samples = []
nsfw_samples = []

for item in nsfw_raw:
    text = item.get("text", "").strip()

    # minimal sanity check only
    if not text:
        continue

    if item["labels"] == 0:
        safe_samples.append({
            "text": text,
            "label": "safe",
            "source": "nsfw_dataset"
        })
    elif item["labels"] == 1:
        nsfw_samples.append({
            "text": text,
            "label": "nsfw",
            "source": "nsfw_dataset"
        })

print("Available samples:")
print("Safe available:", len(safe_samples))
print("NSFW available:", len(nsfw_samples))

# Safety check before sampling
assert len(safe_samples) >= SAFE_TARGET, "Not enough SAFE samples"
assert len(nsfw_samples) >= NSFW_TARGET, "Not enough NSFW samples"

safe_selected = random.sample(safe_samples, SAFE_TARGET)
nsfw_selected = random.sample(nsfw_samples, NSFW_TARGET)

# Normalize ambiguous
for x in ambiguous:
    x["label"] = "ambiguous"
    x["source"] = "ambiguous_generated"

final_data = safe_selected + ambiguous + nsfw_selected
random.shuffle(final_data)

for i, x in enumerate(final_data):
    x["id"] = i + 1

with open("final_training_dataset.json", "w") as f:
    json.dump(final_data, f, indent=2)

print("\nFinal dataset created:")
print("Total:", len(final_data))
print("Safe:", len(safe_selected))
print("Ambiguous:", len(ambiguous))
print("NSFW:", len(nsfw_selected))
