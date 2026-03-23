import { Router, Request, Response, NextFunction } from "express";
import { ScanRequestSchema } from "../schemas/aisleSchema.js";
import { scanImage } from "../services/claudeService.js";
import { classifyProduce } from "../services/classifierService.js";

export const scanRouter = Router();

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

    const { image, mode } = parsed.data;

    // Classifier runs only for product scans — list scans go straight to Claude
    if (mode === "product") {
      try {
        const classifier = await classifyProduce(image);

        if (classifier.confidence === "high") {
          // Skip Claude entirely — classifier is confident enough
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

        const result = await scanImage(image, mode, hints);
        res.json({ items: result.items });
        return;
      } catch {
        // Classifier failed — fall through to Claude with no hints
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
