# AisleIQ Produce Classifier

EfficientNet-B0 fine-tuned on the GroceryStoreDataset to classify fresh fruit and vegetables into 49 fine-grained classes across 34 coarse categories. Packaged goods are excluded — only produce.

## Setup

```bash
cd AisleIQ/backend/classifier
pip install -r requirements.txt
```

## Training

Run with defaults (uses the dataset at the path baked into the script):

```bash
python train_classifier.py
```

Override any path or hyperparameter:

```bash
python train_classifier.py \
  --dataset-dir /path/to/GroceryStoreDataset/dataset \
  --output-dir  ../models \
  --log-dir     ../logs \
  --epochs-frozen   5 \
  --epochs-unfrozen 15 \
  --batch-size 32 \
  --num-workers 4
```

Training runs in two phases:
- **Phase 1 (frozen)** — backbone weights are frozen; only the new classifier head is trained. Fast convergence, avoids destroying ImageNet features early.
- **Phase 2 (unfrozen)** — all layers are trained end-to-end at a lower learning rate with cosine annealing. This is where the model adapts its internal representations to produce.

The best checkpoint (by validation accuracy) is saved to `../models/produce_classifier_best.pt`. A structured run report is appended to `../logs/classifier_training.log`.

## ONNX Export

Once training is complete, export the best checkpoint to ONNX for deployment:

```bash
python export_to_onnx.py --model-dir ../models
```

This writes `../models/produce_classifier.onnx` and runs a verification pass through onnxruntime before reporting the file size. The exported model uses a fixed batch size of 1, matching the single-image inference pattern used in the API.

## Output Files

| File | Description |
|---|---|
| `../models/produce_classifier_best.pt` | Best PyTorch checkpoint (by val accuracy) |
| `../models/produce_classifier.onnx` | ONNX model for deployment |
| `../logs/classifier_training.log` | Append-only structured run log with per-epoch metrics, per-class precision/recall/F1, and top misclassifications |
