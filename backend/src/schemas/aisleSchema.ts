import { z } from "zod";

// Request validation — used by the route handler to validate incoming HTTP requests
export const OrganizeRequestSchema = z.object({
  items: z
    .string()
    .min(1, "Shopping list cannot be empty")
    .max(5000, "Shopping list is too long"),
});

// Structured output schema — passed to Claude via zodOutputFormat to guarantee valid JSON
export const OrganizeOutputSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(z.string()),
    })
  ),
});

export type OrganizeRequest = z.infer<typeof OrganizeRequestSchema>;
export type OrganizeOutput = z.infer<typeof OrganizeOutputSchema>;
