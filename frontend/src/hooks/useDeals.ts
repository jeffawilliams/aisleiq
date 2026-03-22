import { useState } from "react";
import { Deal } from "../types/index.js";

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = async (items: string[], krogerLocationId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setDeals([]);

    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, krogerLocationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to fetch deals");
      }

      setDeals(data.deals as Deal[]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  function resetDeals() { setDeals([]); }

  return { deals, isLoading, error, fetchDeals, resetDeals };
}
