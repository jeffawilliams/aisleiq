"""
generate_class_labels.py — Dump the GroceryStoreDataset class mapping to JSON.

Reads classes.csv and writes class_labels.json to the same directory.
The JSON is committed to the repo and loaded by classifierService.ts at runtime.

Usage:
    python generate_class_labels.py
"""

import csv
import json
from pathlib import Path

CLASSES_CSV = Path("/content/drive/MyDrive/GroceryDataSet/GroceryStoreDataset/dataset/classes.csv")
OUTPUT_JSON = Path("/content/drive/MyDrive/GroceryDataSet/models/class_labels.json")

fine_classes = {}   # {fine_id: {name, coarse_id, coarse_name}}

with CLASSES_CSV.open(newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        fine_id = int(row["Class ID (int)"])
        fine_classes[fine_id] = {
            "name": row["Class Name (str)"],
            "coarse_id": int(row["Coarse Class ID (int)"]),
            "coarse_name": row["Coarse Class Name (str)"],
        }

# Write as an ordered list indexed by fine class ID (0 to max_id)
max_id = max(fine_classes.keys())
labels = [fine_classes[i] for i in range(max_id + 1)]

OUTPUT_JSON.write_text(json.dumps(labels, indent=2))
print(f"Written {len(labels)} class labels to: {OUTPUT_JSON}")
print(json.dumps(labels[:5], indent=2))  # preview first 5
