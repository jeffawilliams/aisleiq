"""
export_to_onnx.py — Export the trained AisleIQ produce classifier to ONNX.

Loads the best PyTorch checkpoint produced by train_classifier.py and converts
it to ONNX format with a fixed batch size of 1 (suitable for server-side
single-image inference). Verifies the export with a dummy forward pass through
onnxruntime before reporting success.

Usage:
    python export_to_onnx.py [--model-dir PATH]
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn as nn
from torchvision import models


# ---------------------------------------------------------------------------
# Model reconstruction
# ---------------------------------------------------------------------------

def build_model_skeleton(num_classes: int) -> nn.Module:
    """
    Reconstruct an EfficientNet-B0 with the same head architecture used during
    training. We load weights from the checkpoint, not from ImageNet, so the
    pretrained=False equivalent is used here (weights=None avoids a network
    download and the checkpoint values will overwrite them anyway).
    """
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


def load_checkpoint(checkpoint_path: Path, device: torch.device) -> tuple[nn.Module, int]:
    """
    Load a checkpoint saved by train_classifier.py.
    Returns the model in eval mode and the number of output classes.
    """
    if not checkpoint_path.exists():
        sys.exit(
            f"ERROR: Checkpoint not found at {checkpoint_path}\n"
            "Run train_classifier.py first to generate a checkpoint."
        )

    checkpoint = torch.load(checkpoint_path, map_location=device)
    state_dict = checkpoint["model_state_dict"]

    # Infer num_classes from the final linear layer weight shape
    # classifier.1.weight has shape (num_classes, in_features)
    num_classes = state_dict["classifier.1.weight"].shape[0]

    model = build_model_skeleton(num_classes)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    print(f"Loaded checkpoint from epoch {checkpoint.get('epoch', '?')} "
          f"(val acc: {checkpoint.get('val_acc', 0.0):.1f}%)")
    print(f"Model: EfficientNet-B0 | Classes: {num_classes}")

    return model, num_classes


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_to_onnx(
    model: nn.Module,
    onnx_path: Path,
    device: torch.device,
) -> None:
    """
    Trace and export the model to ONNX with a fixed batch size of 1.
    Dynamic batch axes are intentionally disabled — the production inference
    path processes one image at a time and a fixed shape allows more aggressive
    runtime optimisations.
    """
    dummy_input = torch.randn(1, 3, 224, 224, device=device)

    torch.onnx.export(
        model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        opset_version=18,           # Minimum supported by current PyTorch ONNX exporter
        do_constant_folding=True,   # Fold constant subexpressions at export time
        input_names=["image"],
        output_names=["logits"],
        # No dynamic_axes — fixed batch size of 1 for inference
    )
    print(f"ONNX model written to: {onnx_path}")


def verify_onnx(onnx_path: Path) -> None:
    """
    Two-stage verification:
      1. onnx.checker validates the graph structure and operator set.
      2. onnxruntime runs a dummy forward pass to confirm runtime compatibility.
    """
    # Stage 1: structural check
    onnx_model = onnx.load(str(onnx_path))
    onnx.checker.check_model(onnx_model)
    print("ONNX graph structure check: PASSED")

    # Stage 2: runtime inference check
    session = ort.InferenceSession(
        str(onnx_path),
        providers=["CPUExecutionProvider"],
    )
    input_name = session.get_inputs()[0].name
    dummy_np = np.random.randn(1, 3, 224, 224).astype(np.float32)
    outputs = session.run(None, {input_name: dummy_np})

    # Confirm output shape matches expected (1, num_classes)
    logits = outputs[0]
    assert logits.ndim == 2 and logits.shape[0] == 1, (
        f"Unexpected output shape: {logits.shape}"
    )
    print(f"onnxruntime inference check: PASSED  |  Output shape: {logits.shape}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export the AisleIQ produce classifier checkpoint to ONNX."
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=Path(__file__).parent / ".." / "models",
        help="Directory containing produce_classifier_best.pt (default: ../models)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_dir: Path = args.model_dir.resolve()

    if not model_dir.exists():
        sys.exit(f"ERROR: Model directory not found: {model_dir}")

    checkpoint_path = model_dir / "produce_classifier_best.pt"
    onnx_path = model_dir / "produce_classifier.onnx"

    # CPU export is reliable and sufficient; GPU is not needed for the trace
    device = torch.device("cpu")

    print("=" * 60)
    print("AisleIQ Produce Classifier — ONNX Export")
    print("=" * 60)

    model, num_classes = load_checkpoint(checkpoint_path, device)

    print("\nExporting to ONNX...")
    export_to_onnx(model, onnx_path, device)

    print("\nVerifying exported model...")
    verify_onnx(onnx_path)

    # Report file size so the caller can confirm a reasonable artifact was produced
    size_mb = onnx_path.stat().st_size / (1024 ** 2)
    print(f"\nFile size: {size_mb:.2f} MB")
    print(f"\nSuccess! ONNX model saved to: {onnx_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
