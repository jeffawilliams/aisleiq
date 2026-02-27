import { Router, Request, Response, NextFunction } from "express";
import { ScanRequestSchema } from "../schemas/aisleSchema.js";
import { scanImage } from "../services/claudeService.js";

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

    try {
      const result = await scanImage(parsed.data.image, parsed.data.mode);
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  }
);
