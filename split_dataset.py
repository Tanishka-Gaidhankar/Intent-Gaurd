import json
from sklearn.model_selection import train_test_split

with open("final_training_dataset.json", "r") as f:
    data = json.load(f)

texts = [x["text"] for x in data]
labels = [x["label"] for x in data]

train_data, temp_data, train_labels, temp_labels = train_test_split(
    data,
    labels,
    test_size=0.30,
    stratify=labels,
    random_state=42
)

val_data, test_data = train_test_split(
    temp_data,
    test_size=0.50,
    stratify=[x["label"] for x in temp_data],
    random_state=42
)

with open("train.json", "w") as f:
    json.dump(train_data, f, indent=2)

with open("val.json", "w") as f:
    json.dump(val_data, f, indent=2)

with open("test.json", "w") as f:
    json.dump(test_data, f, indent=2)

print("Train:", len(train_data))
print("Val:", len(val_data))
print("Test:", len(test_data))
