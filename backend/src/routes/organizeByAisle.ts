import { Router, Request, Response, NextFunction } from "express";
import { OrganizeByAisleRequestSchema } from "../schemas/aisleSchema.js";
import { organizeByAisle } from "../services/claudeService.js";
import { supabase } from "../services/supabaseClient.js";

export const organizeByAisleRouter = Router();

organizeByAisleRouter.post(
  "/organize-by-aisle",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = OrganizeByAisleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stores")
        .select("layout")
        .eq("id", parsed.data.storeId)
        .single();

      if (error || !data) {
        res.status(404).json({ error: "Store not found" });
        return;
      }

      const result = await organizeByAisle(parsed.data.items, data.layout);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
