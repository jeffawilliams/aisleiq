import { Router, Request, Response, NextFunction } from "express";
import { RecipeRequestSchema } from "../schemas/aisleSchema.js";
import { scanRecipe } from "../services/claudeService.js";
import { fetchRecipeHtml } from "../services/urlFetchService.js";

export const recipeRouter = Router();

recipeRouter.post(
  "/recipe",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = RecipeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      });
      return;
    }

    const { mode, image, url, text } = parsed.data;

    try {
      let result;

      if (mode === 'photo') {
        if (!image) {
          res.status(400).json({ error: "image is required for photo mode" });
          return;
        }
        result = await scanRecipe('photo', image);
      } else if (mode === 'url') {
        if (!url) {
          res.status(400).json({ error: "url is required for url mode" });
          return;
        }
        let html: string;
        try {
          html = await fetchRecipeHtml(url);
        } catch (fetchErr) {
          const message = fetchErr instanceof Error
            ? fetchErr.message
            : "Could not fetch that URL. Try pasting the recipe text instead.";
          res.status(422).json({ error: message });
          return;
        }
        result = await scanRecipe('url', html);
      } else {
        // text mode
        if (!text) {
          res.status(400).json({ error: "text is required for text mode" });
          return;
        }
        result = await scanRecipe('text', text);
      }

      if (result.ingredients.length === 0) {
        res.status(400).json({
          error: "No ingredients found. Try a different photo, URL, or paste the text directly.",
        });
        return;
      }

      res.json({ recipeName: result.recipeName, ingredients: result.ingredients });
    } catch (err) {
      next(err);
    }
  }
);
