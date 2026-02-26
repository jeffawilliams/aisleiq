import { Router, Request, Response, NextFunction } from "express";
import { OrganizeRequestSchema } from "../schemas/aisleSchema.js";
import { organizeShoppingList } from "../services/claudeService.js";

export const categorizeRouter = Router();

categorizeRouter.post(
  "/categorize",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = OrganizeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    try {
      const result = await organizeShoppingList(parsed.data.items);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
