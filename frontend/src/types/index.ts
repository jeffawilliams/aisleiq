export interface StoreAisle {
  name: string;
  categories: string[];
}

export interface CategoryResult {
  name: string;
  items: string[];
}

export interface AisleResult {
  name: string;
  categories: CategoryResult[];
}

export interface CategorizeResponse {
  aisles: AisleResult[];
}
