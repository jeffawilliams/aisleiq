export interface AisleResult {
  name: string;
  items: string[];
}

export interface CategorizeResponse {
  aisles: AisleResult[];
}
