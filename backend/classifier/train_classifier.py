"""
train_classifier.py — AisleIQ produce classifier training pipeline.

Trains an EfficientNet-B0 model on the GroceryStoreDataset (Fruit + Vegetables
only; Packages are excluded). Uses a two-phase fine-tuning strategy:
  Phase 1: freeze the backbone, train only the classification head (fast warmup)
  Phase 2: unfreeze all layers, end-to-end fine-tuning with cosine annealing

Outputs:
  - models/produce_classifier_best.pt  (best checkpoint by val accuracy)
  - logs/classifier_training.log       (structured run report, append-only)
"""

import argparse
import csv
import logging
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class GroceryManifestDataset(Dataset):
    """
    Reads one of the GroceryStoreDataset manifest files (train.txt / val.txt /
    test.txt) and presents (image_tensor, fine_label, coarse_label) tuples.

    Rows whose image path contains '/Packages/' are silently skipped so that
    training is restricted to Fruit and Vegetables only.
    """

    def __init__(
        self,
        manifest_path: Path,
        dataset_root: Path,
        transform=None,
    ):
        self.dataset_root = dataset_root
        self.transform = transform
        self.samples: list[tuple[Path, int, int]] = []  # (abs_img_path, fine, coarse)

        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {manifest_path}")

        with manifest_path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                # Format: relative/path/to/image.jpg, fine_id, coarse_id
                parts = [p.strip() for p in line.split(",")]
                if len(parts) != 3:
                    continue
                rel_path, fine_id, coarse_id = parts[0], int(parts[1]), int(parts[2])
                # Exclude packaged goods — only Fruit and Vegetables are in scope
                if "/Packages/" in rel_path:
                    continue
                abs_path = dataset_root / rel_path
                self.samples.append((abs_path, fine_id, coarse_id))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, fine_label, coarse_label = self.samples[idx]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as exc:
            raise RuntimeError(f"Could not load image {img_path}: {exc}") from exc

        if self.transform:
            image = self.transform(image)

        return image, fine_label, coarse_label

    @property
    def fine_labels(self) -> list[int]:
        """All fine-grained labels in dataset order — used for sampler weights."""
        return [s[1] for s in self.samples]


# ---------------------------------------------------------------------------
# Class mapping
# ---------------------------------------------------------------------------

def load_class_mapping(classes_csv: Path) -> tuple[dict[int, str], dict[int, str]]:
    """
    Parse classes.csv and return:
      fine_id_to_name  — {fine_class_id: class_name}
      coarse_id_to_name — {coarse_class_id: coarse_class_name}
    """
    if not classes_csv.exists():
        raise FileNotFoundError(f"classes.csv not found: {classes_csv}")

    fine_map: dict[int, str] = {}
    coarse_map: dict[int, str] = {}

    with classes_csv.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fine_id = int(row["Class ID (int)"])
            coarse_id = int(row["Coarse Class ID (int)"])
            fine_map[fine_id] = row["Class Name (str)"]
            coarse_map[coarse_id] = row["Coarse Class Name (str)"]

    return fine_map, coarse_map


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_train_transform() -> transforms.Compose:
    """Augmentation pipeline for training — designed to improve generalisation
    on a relatively small, imbalanced dataset."""
    return transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.05),
        transforms.RandomRotation(15),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


def get_eval_transform() -> transforms.Compose:
    """Deterministic transform for validation and test — no random ops."""
    return transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def build_model(num_classes: int, device: torch.device) -> nn.Module:
    """
    Load ImageNet-pretrained EfficientNet-B0 and replace the classifier head
    with a new linear layer sized to num_classes. The model is returned with
    the backbone frozen (Phase 1 configuration).
    """
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Swap the head — EfficientNet-B0's classifier is a Sequential(Dropout, Linear)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)

    # Freeze backbone for Phase 1
    for name, param in model.named_parameters():
        if "classifier" not in name:
            param.requires_grad = False

    return model.to(device)


def unfreeze_all(model: nn.Module) -> None:
    """Unfreeze every parameter for Phase 2 end-to-end fine-tuning."""
    for param in model.parameters():
        param.requires_grad = True


# ---------------------------------------------------------------------------
# Sampler and loss weights
# ---------------------------------------------------------------------------

def compute_class_weights(labels: list[int], num_classes: int, device: torch.device):
    """
    Returns:
      sample_weights — per-sample weight tensor for WeightedRandomSampler
      loss_weights   — per-class weight tensor for weighted cross-entropy

    Both are inversely proportional to class frequency, which compensates for
    the imbalance between e.g. Asparagus (16 images) and Apple varieties (278).
    """
    counts = Counter(labels)
    # Guard against any class missing from the split
    freq = torch.tensor(
        [counts.get(c, 1) for c in range(num_classes)], dtype=torch.float32
    )
    loss_weights = (1.0 / freq) / (1.0 / freq).sum() * num_classes
    sample_weights = torch.tensor(
        [1.0 / counts.get(lbl, 1) for lbl in labels], dtype=torch.float32
    )
    return sample_weights, loss_weights.to(device)


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------

def topk_accuracy(output: torch.Tensor, target: torch.Tensor, k: int = 1) -> float:
    """Compute top-k accuracy over a batch."""
    with torch.no_grad():
        batch_size = target.size(0)
        _, pred = output.topk(k, dim=1, largest=True, sorted=True)
        pred = pred.t()
        correct = pred.eq(target.view(1, -1).expand_as(pred))
        correct_k = correct[:k].reshape(-1).float().sum(0)
        return (correct_k * 100.0 / batch_size).item()


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float]:
    """
    Run one pass over loader.
    Returns: (average_loss, top1_accuracy_percent)
    """
    model.eval()
    total_loss, top1_sum, n_batches = 0.0, 0.0, 0
    for images, fine_labels, _ in loader:
        images, fine_labels = images.to(device), fine_labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, fine_labels)
        total_loss += loss.item()
        top1_sum += topk_accuracy(outputs, fine_labels, k=1)
        n_batches += 1
    return total_loss / max(n_batches, 1), top1_sum / max(n_batches, 1)


@torch.no_grad()
def collect_predictions(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> tuple[list[int], list[int], list[int], torch.Tensor]:
    """
    Collect ground-truth fine labels, coarse labels, predicted fine labels,
    and raw logits over the full loader.
    Returns: (true_fine, true_coarse, pred_fine, all_logits)
    """
    model.eval()
    true_fine, true_coarse, pred_fine, logits_list = [], [], [], []
    for images, fine_labels, coarse_labels in loader:
        images = images.to(device)
        outputs = model(images)
        preds = outputs.argmax(dim=1)
        true_fine.extend(fine_labels.tolist())
        true_coarse.extend(coarse_labels.tolist())
        pred_fine.extend(preds.cpu().tolist())
        logits_list.append(outputs.cpu())
    all_logits = torch.cat(logits_list, dim=0)
    return true_fine, true_coarse, pred_fine, all_logits


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def setup_file_logger(log_path: Path) -> logging.Logger:
    """Create a logger that appends to log_path with no timestamp prefix."""
    logger = logging.getLogger("classifier_training")
    logger.setLevel(logging.INFO)
    # Clear any handlers left over from a previous run in the same Python session
    # (Colab re-uses the kernel, so the logger registry persists between script runs)
    logger.handlers.clear()
    handler = logging.FileHandler(log_path, mode="a", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    # Also mirror to stdout
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(stdout_handler)
    return logger


def format_run_header(
    timestamp: str,
    num_fine: int,
    num_coarse: int,
    n_train: int,
    n_val: int,
    n_test: int,
    total_epochs: int,
    epochs_frozen: int,
    epochs_unfrozen: int,
) -> str:
    return (
        "=" * 80 + "\n"
        f"RUN: {timestamp}\n"
        "MODEL: EfficientNet-B0\n"
        "DATASET: GroceryStoreDataset (Fruit + Vegetables, packages excluded)\n"
        f"CLASSES: {num_fine} fine-grained / {num_coarse} coarse\n"
        f"TRAIN: {n_train} images | VAL: {n_val} images | TEST: {n_test} images\n"
        f"EPOCHS: {total_epochs} ({epochs_frozen} frozen + {epochs_unfrozen} unfrozen)\n"
        "-" * 80
    )


def format_epoch_line(epoch: int, total: int, train_loss: float, val_loss: float, val_acc: float, is_best: bool) -> str:
    best_marker = "  [BEST]" if is_best else ""
    return (
        f"  Epoch {epoch:02d}/{total:02d} | "
        f"Train Loss: {train_loss:.3f} | "
        f"Val Loss: {val_loss:.3f} | "
        f"Val Acc: {val_acc:.1f}%"
        f"{best_marker}"
    )


def format_per_class_table(
    true_labels: list[int],
    pred_labels: list[int],
    fine_id_to_name: dict[int, str],
    num_classes: int,
) -> str:
    # Only report on classes that actually appear in the test set — avoids
    # polluting the table with zero rows for excluded categories (e.g. Packages)
    present_labels = sorted(set(true_labels))
    report = classification_report(
        true_labels,
        pred_labels,
        labels=present_labels,
        target_names=[fine_id_to_name.get(i, str(i)) for i in present_labels],
        output_dict=True,
        zero_division=0,
    )
    header = f"  {'Class':<25}| {'Precision':>9} | {'Recall':>6} | {'F1':>5} | {'Support':>7}"
    separator = "  " + "-" * 25 + "|" + "-" * 11 + "|" + "-" * 8 + "|" + "-" * 7 + "|" + "-" * 8
    rows = [header, separator]
    for class_id in present_labels:
        name = fine_id_to_name.get(class_id, str(class_id))
        stats = report.get(name, {})
        p = stats.get("precision", 0.0)
        r = stats.get("recall", 0.0)
        f1 = stats.get("f1-score", 0.0)
        sup = int(stats.get("support", 0))
        rows.append(
            f"  {name:<25}|   {p:.2f}    |  {r:.2f}  | {f1:.2f}  |   {sup:>4}"
        )
    return "\n".join(rows)


def format_confusion_notes(
    true_labels: list[int],
    pred_labels: list[int],
    fine_id_to_name: dict[int, str],
    top_n: int = 10,
) -> str:
    """Summarise the top-N most frequent misclassifications."""
    misclassifications: Counter = Counter()
    for true, pred in zip(true_labels, pred_labels):
        if true != pred:
            misclassifications[(pred, true)] += 1

    lines = []
    for (pred_id, true_id), count in misclassifications.most_common(top_n):
        pred_name = fine_id_to_name.get(pred_id, str(pred_id))
        true_name = fine_id_to_name.get(true_id, str(true_id))
        lines.append(f"  {pred_name} -> {true_name}: {count} misclassification(s)")

    return "\n".join(lines) if lines else "  No misclassifications."


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

def run_training_phase(
    model: nn.Module,
    loader: DataLoader,
    val_loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler,
    device: torch.device,
    start_epoch: int,
    num_epochs: int,
    total_epochs: int,
    best_val_acc: float,
    checkpoint_path: Path,
    logger: logging.Logger,
    epoch_logs: list[str],
) -> tuple[float, int]:
    """
    Generic training loop shared between Phase 1 and Phase 2.
    Returns updated (best_val_acc, best_epoch).
    """
    best_epoch = -1

    for ep in range(num_epochs):
        current_epoch = start_epoch + ep + 1
        model.train()
        running_loss = 0.0
        n_batches = 0

        for images, fine_labels, _ in loader:
            images, fine_labels = images.to(device), fine_labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, fine_labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            n_batches += 1

        train_loss = running_loss / max(n_batches, 1)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)

        if scheduler is not None:
            scheduler.step()

        is_best = val_acc > best_val_acc
        if is_best:
            best_val_acc = val_acc
            best_epoch = current_epoch
            torch.save(
                {
                    "epoch": current_epoch,
                    "model_state_dict": model.state_dict(),
                    "val_acc": val_acc,
                },
                checkpoint_path,
            )

        line = format_epoch_line(current_epoch, total_epochs, train_loss, val_loss, val_acc, is_best)
        epoch_logs.append(line)
        logger.info(line)

    return best_val_acc, best_epoch


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train EfficientNet-B0 produce classifier on GroceryStoreDataset."
    )
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=Path("/Users/jeff.williams/downloads/GroceryStoreDataset/dataset"),
        help="Root directory of the GroceryStoreDataset (contains train.txt etc.)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / ".." / "models",
        help="Directory where model checkpoints are saved.",
    )
    parser.add_argument(
        "--log-dir",
        type=Path,
        default=Path(__file__).parent / ".." / "logs",
        help="Directory where training logs are written.",
    )
    parser.add_argument(
        "--epochs-frozen",
        type=int,
        default=5,
        help="Number of epochs to train with backbone frozen (Phase 1).",
    )
    parser.add_argument(
        "--epochs-unfrozen",
        type=int,
        default=15,
        help="Number of epochs to train end-to-end (Phase 2).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Mini-batch size (default 32).",
    )
    parser.add_argument(
        "--num-workers",
        type=int,
        default=4,
        help="DataLoader worker processes (default 4).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    dataset_dir: Path = args.dataset_dir.resolve()
    output_dir: Path = args.output_dir.resolve()
    log_dir: Path = args.log_dir.resolve()

    # Validate dataset directory up front to surface a clear error message
    if not dataset_dir.exists():
        sys.exit(f"ERROR: Dataset directory not found: {dataset_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    log_path = log_dir / "classifier_training.log"
    logger = setup_file_logger(log_path)

    # ------------------------------------------------------------------
    # Class mapping
    # ------------------------------------------------------------------
    fine_id_to_name, coarse_id_to_name = load_class_mapping(dataset_dir / "classes.csv")
    num_fine_classes = len(fine_id_to_name)
    num_coarse_classes = len(coarse_id_to_name)

    # ------------------------------------------------------------------
    # Datasets
    # ------------------------------------------------------------------
    train_dataset = GroceryManifestDataset(
        dataset_dir / "train.txt", dataset_dir, transform=get_train_transform()
    )
    val_dataset = GroceryManifestDataset(
        dataset_dir / "val.txt", dataset_dir, transform=get_eval_transform()
    )
    test_dataset = GroceryManifestDataset(
        dataset_dir / "test.txt", dataset_dir, transform=get_eval_transform()
    )

    # ------------------------------------------------------------------
    # Weighted sampler — oversamples minority classes during training
    # ------------------------------------------------------------------
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")

    sample_weights, loss_weights = compute_class_weights(
        train_dataset.fine_labels, num_fine_classes, device
    )
    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True,
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        sampler=sampler,  # mutually exclusive with shuffle=True
        num_workers=args.num_workers,
        pin_memory=True,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=True,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=True,
    )

    # ------------------------------------------------------------------
    # Model and loss
    # ------------------------------------------------------------------
    model = build_model(num_fine_classes, device)
    criterion = nn.CrossEntropyLoss(weight=loss_weights)
    checkpoint_path = output_dir / "produce_classifier_best.pt"
    total_epochs = args.epochs_frozen + args.epochs_unfrozen
    epoch_logs: list[str] = []

    # ------------------------------------------------------------------
    # Log run header
    # ------------------------------------------------------------------
    run_ts = datetime.now(timezone.utc).isoformat()
    header = format_run_header(
        run_ts,
        num_fine_classes,
        num_coarse_classes,
        len(train_dataset),
        len(val_dataset),
        len(test_dataset),
        total_epochs,
        args.epochs_frozen,
        args.epochs_unfrozen,
    )
    logger.info(header)
    logger.info("TRAINING PROGRESS:")

    # ------------------------------------------------------------------
    # Phase 1: frozen backbone, classifier head only
    # ------------------------------------------------------------------
    logger.info(f"  --- Phase 1: frozen backbone ({args.epochs_frozen} epochs, LR=1e-3) ---")
    optimizer_p1 = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()), lr=1e-3
    )

    best_val_acc = 0.0
    best_val_acc, _ = run_training_phase(
        model=model,
        loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        optimizer=optimizer_p1,
        scheduler=None,
        device=device,
        start_epoch=0,
        num_epochs=args.epochs_frozen,
        total_epochs=total_epochs,
        best_val_acc=best_val_acc,
        checkpoint_path=checkpoint_path,
        logger=logger,
        epoch_logs=epoch_logs,
    )

    # ------------------------------------------------------------------
    # Phase 2: unfreeze all, end-to-end fine-tuning
    # ------------------------------------------------------------------
    logger.info(f"  --- Phase 2: full fine-tuning ({args.epochs_unfrozen} epochs, LR=1e-4, cosine annealing) ---")
    unfreeze_all(model)
    optimizer_p2 = torch.optim.AdamW(model.parameters(), lr=1e-4)
    scheduler_p2 = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer_p2, T_max=args.epochs_unfrozen
    )

    best_val_acc, best_epoch = run_training_phase(
        model=model,
        loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        optimizer=optimizer_p2,
        scheduler=scheduler_p2,
        device=device,
        start_epoch=args.epochs_frozen,
        num_epochs=args.epochs_unfrozen,
        total_epochs=total_epochs,
        best_val_acc=best_val_acc,
        checkpoint_path=checkpoint_path,
        logger=logger,
        epoch_logs=epoch_logs,
    )

    logger.info("-" * 80)

    # ------------------------------------------------------------------
    # Test set evaluation — reload best checkpoint first
    # ------------------------------------------------------------------
    logger.info("TEST SET EVALUATION:")

    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])

    true_fine, true_coarse, pred_fine, all_logits = collect_predictions(
        model, test_loader, device
    )

    # Top-1 fine-grained accuracy
    top1_fine = sum(t == p for t, p in zip(true_fine, pred_fine)) / len(true_fine) * 100

    # Top-3 fine-grained accuracy
    top3_correct = 0
    _, top3_preds = all_logits.topk(3, dim=1, largest=True, sorted=True)
    for i, true_label in enumerate(true_fine):
        if true_label in top3_preds[i].tolist():
            top3_correct += 1
    top3_fine = top3_correct / len(true_fine) * 100

    # Top-1 coarse accuracy — map predicted fine class to coarse via CSV
    # Build fine_id -> coarse_id lookup from the dataset samples directly
    # (avoids re-reading CSV; the test loader's dataset has (path, fine, coarse))
    fine_to_coarse: dict[int, int] = {}
    for _, fine_id, coarse_id in test_dataset.samples:
        fine_to_coarse[fine_id] = coarse_id

    pred_coarse = [fine_to_coarse.get(p, -1) for p in pred_fine]
    top1_coarse = sum(t == p for t, p in zip(true_coarse, pred_coarse)) / len(true_coarse) * 100

    logger.info(f"  Top-1 Accuracy (Fine-Grained): {top1_fine:.1f}%")
    logger.info(f"  Top-1 Accuracy (Coarse):       {top1_coarse:.1f}%")
    logger.info(f"  Top-3 Accuracy (Fine-Grained): {top3_fine:.1f}%")
    logger.info("")
    logger.info("PER-CLASS RESULTS (Fine-Grained):")
    logger.info(format_per_class_table(true_fine, pred_fine, fine_id_to_name, num_fine_classes))
    logger.info("")
    logger.info("CONFUSION NOTES (top 10 misclassifications):")
    logger.info(format_confusion_notes(true_fine, pred_fine, fine_id_to_name, top_n=10))
    logger.info("")
    logger.info(f"CHECKPOINT: {checkpoint_path.relative_to(output_dir.parent)}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
