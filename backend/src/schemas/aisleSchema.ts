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

export const ScanRequestSchema = z.object({
  image: z.string().min(1),
  mode: z.enum(['product', 'list'])
});

export const ScanOutputSchema = z.object({
  items: z.array(z.string())
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;
export type ScanOutput = z.infer<typeof ScanOutputSchema>;

export const DealsRequestSchema = z.object({
  items: z.array(z.string()).min(1, "Items list cannot be empty"),
  krogerLocationId: z.string().min(1, "Kroger location ID is required"),
});

export type DealsRequest = z.infer<typeof DealsRequestSchema>;

export const OrganizeByAisleRequestSchema = z.object({
  items: z.string().min(1, "Shopping list cannot be empty"),
  storeId: z.number().int().positive("Store ID must be a positive integer"),
});

export type OrganizeByAisleRequest = z.infer<typeof OrganizeByAisleRequestSchema>;
