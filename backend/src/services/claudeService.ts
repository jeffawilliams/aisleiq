import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OrganizeOutputSchema, OrganizeOutput, ScanOutputSchema, ScanOutput, RecipeScanOutputSchema, RecipeScanOutput } from "../schemas/aisleSchema.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a grocery shopping assistant. Your job is to organize a shopping list into standard grocery store categories. The categories below reflect how real grocery stores are actually organized. Follow these rules precisely:

1. Assign every item from the shopping list to exactly one category — no item can be skipped or duplicated.
2. Use the standard category names listed below. Only return categories that have at least one item.
3. If an item does not clearly belong to any listed category, place it in a category named "Other".
4. Preserve the original spelling and phrasing of each item from the shopping list.
5. Recognize brand names, quantities, and shorthand (e.g. "OJ" → Beverages, "Tillamook" → Dairy & Eggs, "Charmin" → Paper Products).

Standard grocery categories (use these names exactly):
- Produce: fresh vegetables, cooking vegetables, fruit, fresh herbs, packaged salads, plant-based fresh items
- Floral: flowers, plants
- Meat & Seafood: beef, ground beef, poultry, pork, grilling sausage, smoked meats, seafood, fresh fish
- Deli & Prepared Foods: ready-to-eat items, charcuterie, specialty cheese, dips & spreads, lunch meats, hot dogs, sausage, bacon
- Bakery: bread, rolls, cakes, pastries, tortillas, pita
- Dairy & Eggs: milk, yogurt, cheese, eggs, butter, cream, dough & biscuits, bread dough, refrigerated pasta
- Frozen: frozen dinners/entrees, frozen vegetables, frozen potatoes, frozen breakfast items, pizza, breaded chicken, frozen desserts, ice cream, frozen seafood, frozen meat
- Beverages: soft drinks, water, energy drinks, sports drinks, juice, box juices, coffee, tea, powdered drinks
- Alcohol: wine, beer, spirits, cocktail mixes
- Canned & Packaged: canned vegetables, canned meat, canned fruit, soups, prepared/packaged foods, gravy, stuffing
- Pasta, Rice & Grains: pasta, pasta sauces, rice, grains, quinoa
- Condiments & Dressings: dressings, mayo, mustard, ketchup, pickles, olives, vinegar, hot sauce, soy sauce
- Snacks: chips, cookies, crackers, nuts, snack mixes, candy, granola, snack pudding, popcorn, jerky
- Breakfast & Cereal: cereal, granola, pancake mix, syrup, peanut butter, jelly, oatmeal, breakfast bars
- Baking: flour, sugar, baking soda, baking powder, cake mixes, chocolate chips, vanilla, cooking spray
- International: international and ethnic foods, specialty imports
- Personal Care: shave/shaving needs, deodorant, bath soap, feminine hygiene, hair care, shampoo, skin care, oral care, nail care, cosmetics, cough/cold, first aid, pain relief, antacids, vitamins, diet & nutrition, adult nutrition
- Household & Cleaning: cleaning supplies, laundry detergent, dish soap, mops/brooms, food wrap, aluminum foil, parchment paper, storage bags, resealable bags, cups, plates, trash bags, light bulbs, furnace filters, pest control, bug spray
- Paper Products: bath tissue, paper towels, napkins, facial tissue
- Pet: cat food, dog food, cat litter, pet treats, pet supplies
- Baby: baby food, baby formula, diapers, baby needs
- General Merchandise: stationery, greeting cards, gift cards, kitchen gadgets, school supplies, seasonal items, ice, charcoal`;

const PRODUCT_PROMPT = "Identify the product shown in this image. Return the full product name exactly as it appears on the package — include brand name, product name, flavor or variety, and size or quantity if visible. If you see multiple distinct products, return each as a separate item. Return a JSON array of strings. Return only the JSON array.";
const LIST_PROMPT = "This image contains a shopping list or list of items. Extract every item you can read from the list. Return them as a JSON array of strings. Return only the JSON array.";

export async function scanImage(image: string, mode: 'product' | 'list'): Promise<ScanOutput> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
        { type: "text", text: mode === 'product' ? PRODUCT_PROMPT : LIST_PROMPT }
      ]
    }],
    output_config: {
      format: zodOutputFormat(ScanOutputSchema),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  return ScanOutputSchema.parse(JSON.parse(textBlock.text));
}

// Safety net: any item Claude dropped gets placed in "Other" so nothing is ever lost.
function ensureAllItemsPlaced(result: OrganizeOutput, inputItems: string[]): OrganizeOutput {
  const placed = new Set(result.categories.flatMap(c => c.items.map(i => i.toLowerCase().trim())));
  const missing = inputItems.filter(i => !placed.has(i.toLowerCase().trim()));
  if (missing.length === 0) return result;

  const other = result.categories.find(c => c.name.toLowerCase() === "other");
  if (other) {
    other.items.push(...missing);
  } else {
    result.categories.push({ name: "Other", items: missing });
  }
  return result;
}

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

  const result = OrganizeOutputSchema.parse(JSON.parse(textBlock.text));
  const inputItems = items.split("\n").map(i => i.trim()).filter(Boolean);
  return ensureAllItemsPlaced(result, inputItems);
}

const RECIPE_PROMPT = `Extract the recipe name and all ingredients from the content provided.

Rules:
1. Extract the recipe name if present. If no recipe name is found, return null.
2. Extract every ingredient and return it as an object with two fields:
   - name: the grocery-list-friendly ingredient name in Title Case (e.g. "All-Purpose Flour", "Unsalted Butter", "Large Eggs")
   - quantity: the measurement exactly as written in the recipe (e.g. "2 cups", "1 tbsp", "3 large", "½ tsp"), or null if no quantity is given
3. Normalize ingredient names to Title Case.
4. Exclude non-ingredient lines such as instructions, section headers, serving notes, cook times, and nutritional information.
5. If no ingredients are found, return an empty array for ingredients.`;

export async function scanRecipe(mode: 'photo' | 'url' | 'text', content: string): Promise<RecipeScanOutput> {
  let messages: Anthropic.MessageParam[];

  if (mode === 'photo') {
    messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: content } },
        { type: "text", text: RECIPE_PROMPT },
      ],
    }];
  } else {
    const label = mode === 'url' ? 'HTML page content' : 'recipe text';
    messages = [{
      role: "user",
      content: `${RECIPE_PROMPT}\n\n${label}:\n${content}`,
    }];
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages,
    output_config: {
      format: zodOutputFormat(RecipeScanOutputSchema),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  return RecipeScanOutputSchema.parse(JSON.parse(textBlock.text));
}

export async function organizeByAisle(items: string, layout: unknown): Promise<OrganizeOutput> {
  const layoutText = JSON.stringify(layout, null, 2);
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are organizing a shopping list by the physical layout of a specific store. The store layout below lists sections in the exact order a shopper encounters them walking through the store from entrance to checkout.\n\nRules:\n1. Assign every item to the section where it most likely lives in this store.\n2. Return the sections in EXACTLY the same order they appear in the layout — do not reorder them.\n3. Only include sections that have at least one item assigned to them.\n4. Preserve the original spelling of each item.\n5. If an item cannot be placed in any store section, assign it to a section named "Other" appended at the end.\n\nStore layout (in walk-through order):\n${layoutText}\n\nShopping list:\n${items}`,
    }],
    output_config: {
      format: zodOutputFormat(OrganizeOutputSchema),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const result = OrganizeOutputSchema.parse(JSON.parse(textBlock.text));
  const inputItems = items.split("\n").map(i => i.trim()).filter(Boolean);
  return ensureAllItemsPlaced(result, inputItems);
}
