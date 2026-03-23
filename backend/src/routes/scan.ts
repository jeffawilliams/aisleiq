import { Router, Request, Response, NextFunction } from "express";
import { ScanRequestSchema } from "../schemas/aisleSchema.js";
import { scanImage } from "../services/claudeService.js";
import { classifyProduce } from "../services/classifierService.js";
import { supabase } from "../services/supabaseClient.js";

export const scanRouter = Router();

function logScanEvent(
  userId: string | undefined,
  confidence: string,
  claudeCalled: boolean,
  topScore?: number,
  topFineName?: string,
  topCoarseName?: string,
): void {
  supabase.from("scan_events").insert({
    user_id: userId ?? null,
    confidence,
    claude_called: claudeCalled,
    top_score: topScore ?? null,
    top_fine_name: topFineName ?? null,
    top_coarse_name: topCoarseName ?? null,
  }).then(({ error }) => {
    if (error) console.error("scan_events insert failed:", error.message);
  });
}

scanRouter.post(
  "/scan",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ScanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    const { image, mode, userId } = parsed.data;

    // Classifier runs only for product scans — list scans go straight to Claude
    if (mode === "product") {
      try {
        const classifier = await classifyProduce(image);

        if (classifier.confidence === "high") {
          // Skip Claude entirely — classifier is confident enough
          logScanEvent(userId, "high", false, classifier.topScore, classifier.topFineName, classifier.topCoarseName);
          res.json({ items: [classifier.topFineName] });
          return;
        }

        // Medium: pass Top-1 Coarse + Top-3 Fine as hints to Claude
        // Low: no hints, Claude handles it alone
        const hints =
          classifier.confidence === "medium"
            ? {
                topCoarseName: classifier.topCoarseName,
                top3FineNames: classifier.top3FineNames,
              }
            : undefined;

        logScanEvent(userId, classifier.confidence, true, classifier.topScore, classifier.topFineName, classifier.topCoarseName);
        const result = await scanImage(image, mode, hints);
        res.json({ items: result.items });
        return;
      } catch {
        // Classifier failed — fall through to Claude with no hints
        logScanEvent(userId, "classifier_error", true);
      }
    }

    try {
      const result = await scanImage(image, mode);
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  }
);
