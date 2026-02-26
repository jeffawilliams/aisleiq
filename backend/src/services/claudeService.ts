import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OrganizeOutputSchema, OrganizeOutput } from "../schemas/aisleSchema.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a grocery shopping assistant. Your job is to organize a shopping list into standard grocery store categories. Follow these rules precisely:

1. Assign every item from the shopping list to exactly one category — no item can be skipped or duplicated.
2. Use standard grocery store category names that shoppers would recognize (e.g. Produce, Dairy & Eggs, Meat & Seafood, Bakery, Frozen, Canned & Packaged, Breakfast, Beverages, Snacks, Condiments & Sauces, Baking, Pasta & Rice, Personal Care, Household).
3. Only include categories that have at least one item — do not return empty categories.
4. If an item does not clearly belong to any standard category, place it in a category named "Other".
5. Preserve the original spelling and phrasing of each item from the shopping list.
6. Recognize brand names, quantities, and shorthand (e.g. "OJ" = orange juice → Beverages, "Tillamook" = cheese → Dairy & Eggs).`;

export async function organizeShoppingList(items: string): Promise<OrganizeOutput> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Shopping list:\n${items}` }],
    output_config: {
      format: zodOutputFormat(OrganizeOutputSchema),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  return OrganizeOutputSchema.parse(JSON.parse(textBlock.text));
}
