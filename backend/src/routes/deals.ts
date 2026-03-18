import { Router, Request, Response, NextFunction } from "express";
import { DealsRequestSchema } from "../schemas/aisleSchema.js";
import { getDealsForItems } from "../services/krogerService.js";

export const dealsRouter = Router();

dealsRouter.post(
  "/deals",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = DealsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    try {
      const deals = await getDealsForItems(
        parsed.data.items,
        parsed.data.krogerLocationId
      );
      res.json({ deals });
    } catch (err) {
      next(err);
    }
  }
);
