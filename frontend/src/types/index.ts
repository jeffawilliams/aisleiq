export interface CategoryResult {
  name: string;
  items: string[];
}

export interface OrganizeResponse {
  categories: CategoryResult[];
}

export interface AisleResult {
  name: string;
  categories: CategoryResult[];
}

export interface StoreAisle {
  name: string;
  categories: string[];
}

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

export interface Store {
  id: number;
  name: string;
  kroger_location_id: string | null;
}
