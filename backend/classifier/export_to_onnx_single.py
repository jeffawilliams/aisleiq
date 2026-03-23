"""
export_to_onnx_single.py — Export the AisleIQ produce classifier to a single
self-contained ONNX file with weights embedded (no external .data sidecar).

Usage:
    python export_to_onnx_single.py
"""

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn as nn
from pathlib import Path
from torchvision import models

CHECKPOINT_PATH = Path("/content/drive/MyDrive/GroceryDataSet/models/produce_classifier_best.pt")
ONNX_PATH = Path("/content/drive/MyDrive/GroceryDataSet/models/produce_classifier.onnx")

# Load checkpoint
checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu")
num_classes = checkpoint["model_state_dict"]["classifier.1.weight"].shape[0]
print(f"Loaded checkpoint: epoch {checkpoint.get('epoch', '?')}, val_acc {checkpoint.get('val_acc', 0):.1f}%")
print(f"Classes: {num_classes}")

# Rebuild model
model = models.efficientnet_b0(weights=None)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

# Export using the legacy exporter (dynamo=False) which produces a single
# self-contained file with weights embedded — no external .data sidecar.
dummy = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy,
    str(ONNX_PATH),
    dynamo=False,
    export_params=True,
    opset_version=18,
    do_constant_folding=True,
    input_names=["image"],
    output_names=["logits"],
)

print(f"Exported to: {ONNX_PATH}")
print(f"File size: {ONNX_PATH.stat().st_size / (1024 ** 2):.2f} MB")

# Verify graph structure
onnx.checker.check_model(onnx.load(str(ONNX_PATH)))
print("ONNX graph check: PASSED")

# Verify inference
session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
dummy_np = np.random.randn(1, 3, 224, 224).astype(np.float32)
outputs = session.run(None, {session.get_inputs()[0].name: dummy_np})
print(f"Inference check: PASSED  |  Output shape: {outputs[0].shape}")
print("Done")
