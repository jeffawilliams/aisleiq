import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AisleOutputSchema, AisleOutput } from "../schemas/aisleSchema.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface StoreAisle {
  name: string;
  categories: string[];
}

const SYSTEM_PROMPT = `You are a grocery shopping assistant. Your sole job is to sort shopping list items into the store categories that the user has defined. Follow these rules precisely:

1. Assign every item from the shopping list to exactly one category — no item can be skipped or duplicated.
2. Use only the category names exactly as provided. Do not rename, combine, or create new categories.
3. If an item does not clearly belong to any of the provided categories, place it in a category named "Other" inside an aisle named "Other".
4. Return every aisle and every category in your response, even if a category has zero items.
5. The "Other" aisle (if needed) should always be included as the last entry in your response.
6. Preserve the original spelling and phrasing of each item from the shopping list.`;

export async function categorizeShoppingList(
  aisles: StoreAisle[],
  items: string
): Promise<AisleOutput> {
  const layoutLines = aisles.map((aisle) => {
    return `${aisle.name}: ${aisle.categories.join(", ")}`;
  });
  const userMessage = `Store layout:\n${layoutLines.join("\n")}\n\nShopping list:\n${items}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
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
