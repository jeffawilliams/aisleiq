export interface Deal {
  listItem: string;
  productName: string;
  brand: string;
  size: string;
  regularPrice: number;
  promoPrice: number;
  savings: number;
  savingsPct: number;
  expiresAt: string | null;
  matchType: "exact" | "general";
}

const STOP_WORDS = new Set(["a", "an", "the", "of", "and", "or", "with", "in", "for"]);

function classifyMatch(listItem: string, productName: string): "exact" | "general" {
  const words = listItem
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  if (words.length === 0) return "general";
  const nameLower = productName.toLowerCase();
  return words.some(w => nameLower.includes(w)) ? "exact" : "general";
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getKrogerToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt - now > 60_000) {
    return cachedToken;
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Kroger credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.kroger.com/v1/connect/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });

  if (!res.ok) {
    throw new Error(`Kroger token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

async function fetchDealForItem(
  item: string,
  krogerLocationId: string,
  token: string
): Promise<Deal | null> {
  const params = new URLSearchParams({
    "filter.term": item,
    "filter.locationId": krogerLocationId,
    "filter.limit": "3",
    "filter.fulfillment": "ais",
  });

  const res = await fetch(`https://api.kroger.com/v1/products?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { data?: KrogerProduct[] };
  const products = data.data ?? [];

  for (const product of products) {
    const priceInfo = product.items?.[0]?.price;
    if (!priceInfo?.promo) continue;

    const regularPrice = priceInfo.regular ?? priceInfo.promo;
    const promoPrice = priceInfo.promo;
    const savings = parseFloat((regularPrice - promoPrice).toFixed(2));
    const savingsPct = regularPrice > 0
      ? Math.round((savings / regularPrice) * 100)
      : 0;

    const productName = product.description ?? item;
    return {
      listItem: item,
      productName,
      brand: product.brand ?? "",
      size: product.items?.[0]?.size ?? "",
      regularPrice,
      promoPrice,
      savings,
      savingsPct,
      expiresAt: priceInfo.promoExpiration ?? null,
      matchType: classifyMatch(item, productName),
    };
  }

  return null;
}

interface KrogerProduct {
  description?: string;
  brand?: string;
  items?: Array<{
    price?: {
      regular?: number;
      promo?: number;
      promoExpiration?: string;
    };
    size?: string;
  }>;
}

export async function getDealsForItems(
  items: string[],
  krogerLocationId: string
): Promise<Deal[]> {
  const token = await getKrogerToken();

  const results = await Promise.allSettled(
    items.map(item => fetchDealForItem(item, krogerLocationId, token))
  );

  const deals: Deal[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      deals.push(result.value);
    }
  }

  return deals;
}
