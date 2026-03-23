import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "../../models");

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.50;

interface ClassLabel {
  name: string;
  coarse_id: number;
  coarse_name: string;
}

export interface ClassifierResult {
  confidence: "high" | "medium" | "low";
  topFineName: string;
  topCoarseName: string;
  top3FineNames: string[];
  topScore: number;
}

// Loaded once at startup — avoids re-reading from disk on every request
const classLabels: ClassLabel[] = JSON.parse(
  readFileSync(join(MODELS_DIR, "class_labels.json"), "utf-8")
);

// ONNX session is lazily initialised on the first classify call
let session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!session) {
    session = await ort.InferenceSession.create(
      join(MODELS_DIR, "produce_classifier.onnx")
    );
  }
  return session;
}

function softmax(logits: Float32Array): Float32Array {
  const max = Math.max(...Array.from(logits));
  const exps = Array.from(logits).map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return new Float32Array(exps.map((x) => x / sum));
}

async function preprocessImage(base64: string): Promise<Float32Array> {
  const buffer = Buffer.from(base64, "base64");

  const { data } = await sharp(buffer)
    .resize(224, 224)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert HWC uint8 RGB → CHW float32 with ImageNet normalisation
  const tensor = new Float32Array(3 * 224 * 224);
  for (let i = 0; i < 224 * 224; i++) {
    for (let c = 0; c < 3; c++) {
      const pixel = data[i * 3 + c] / 255.0;
      tensor[c * 224 * 224 + i] = (pixel - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
    }
  }
  return tensor;
}

export async function classifyProduce(
  base64Image: string
): Promise<ClassifierResult> {
  const [sess, tensorData] = await Promise.all([
    getSession(),
    preprocessImage(base64Image),
  ]);

  const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, 224, 224]);
  const outputs = await sess.run({ image: inputTensor });
  const logits = outputs["logits"].data as Float32Array;
  const probs = softmax(logits);

  // Sort all classes by probability descending, take top 3
  const ranked = Array.from(probs)
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);

  const top3 = ranked.slice(0, 3);
  const topScore = top3[0].score;
  const topLabel = classLabels[top3[0].idx];

  let confidence: "high" | "medium" | "low";
  if (topScore >= HIGH_CONFIDENCE_THRESHOLD) {
    confidence = "high";
  } else if (topScore >= MEDIUM_CONFIDENCE_THRESHOLD) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    confidence,
    topFineName: topLabel.name,
    topCoarseName: topLabel.coarse_name,
    top3FineNames: top3.map((t) => classLabels[t.idx].name),
    topScore,
  };
}
