import { z } from "zod";

// Request validation — used by the route handler to validate incoming HTTP requests
export const CategorizeRequestSchema = z.object({
  aisles: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        categories: z.array(z.string().min(1).max(50)).min(1).max(20),
      })
    )
    .min(1, "At least one aisle is required")
    .max(20, "Maximum 20 aisles allowed"),
  items: z
    .string()
    .min(1, "Shopping list cannot be empty")
    .max(5000, "Shopping list is too long"),
});

// Structured output schema — passed to Claude via zodOutputFormat to guarantee valid JSON
export const AisleOutputSchema = z.object({
  aisles: z.array(
    z.object({
      name: z.string(),
      categories: z.array(
        z.object({
          name: z.string(),
          items: z.array(z.string()),
        })
      ),
    })
  ),
});

export type CategorizeRequest = z.infer<typeof CategorizeRequestSchema>;
export type AisleOutput = z.infer<typeof AisleOutputSchema>;
