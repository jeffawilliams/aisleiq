import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AisleOutputSchema, AisleOutput } from "../schemas/aisleSchema.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a grocery shopping assistant. Your sole job is to sort shopping list items into the store aisles that the user has defined. Follow these rules precisely:

1. Every item from the shopping list must appear in exactly one aisle — no item can be skipped or duplicated.
2. Use only the aisle names exactly as provided. Do not rename, combine, or create new aisles.
3. If an item does not clearly belong to any of the provided aisles, place it in an aisle named "Other".
4. Return all provided aisle names in your response, even if an aisle has zero items.
5. The "Other" aisle should always be included as the last entry in your response.
6. Preserve the original spelling and phrasing of each item from the shopping list.`;

export async function categorizeShoppingList(
  aisles: string[],
  items: string
): Promise<AisleOutput> {
  const userMessage = `Aisles: ${aisles.join(", ")}\n\nShopping list:\n${items}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: zodOutputFormat(AisleOutputSchema),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  return AisleOutputSchema.parse(JSON.parse(textBlock.text));
}
