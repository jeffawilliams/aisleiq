const MAX_HTML_LENGTH = 50_000;

export async function fetchRecipeHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ShoppingListAssist/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    return text.length > MAX_HTML_LENGTH ? text.slice(0, MAX_HTML_LENGTH) : text;
  } catch (err) {
    throw new Error("Could not fetch that URL. Try pasting the recipe text instead.");
  } finally {
    clearTimeout(timeout);
  }
}
