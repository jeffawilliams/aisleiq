import { Router, Request, Response, NextFunction } from "express";
import { CategorizeRequestSchema } from "../schemas/aisleSchema.js";
import { categorizeShoppingList } from "../services/claudeService.js";

export const categorizeRouter = Router();

categorizeRouter.post(
  "/categorize",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CategorizeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    try {
      const result = await categorizeShoppingList(
        parsed.data.aisles,
        parsed.data.items
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
