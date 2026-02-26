export interface CategoryResult {
  name: string;
  items: string[];
}

export interface OrganizeResponse {
  categories: CategoryResult[];
}
