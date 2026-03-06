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
