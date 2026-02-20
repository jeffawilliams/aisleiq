import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabaseClient.js";

export const layoutRouter = Router();

const StoreAisleSchema = z.array(
  z.object({
    name: z.string(),
    categories: z.array(z.string()),
  })
);

// GET /api/layout — fetch the saved store layout
layoutRouter.get("/layout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from("store_layout")
      .select("aisles")
      .eq("id", 1)
      .single();

    if (error) throw error;
    res.json({ aisles: data.aisles });
  } catch (err) {
    next(err);
  }
});

// PUT /api/layout — save the store layout
layoutRouter.put("/layout", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = StoreAisleSchema.safeParse(req.body.aisles);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid layout data" });
    return;
  }

  try {
    const { error } = await supabase.from("store_layout").upsert({
      id: 1,
      aisles: parsed.data,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
