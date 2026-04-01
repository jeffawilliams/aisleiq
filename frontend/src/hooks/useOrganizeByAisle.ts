import { useState } from "react";
import { OrganizeResponse } from "../types/index.js";

export function useOrganizeByAisle() {
  const [result, setResult] = useState<OrganizeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organizeByAisle = async (items: string, storeId: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/organize-by-aisle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, storeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setResult(data as OrganizeResponse);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); };
  const restore = (r: OrganizeResponse) => { setResult(r); setError(null); };

  return { organizeByAisle, result, isLoading, error, reset, restore };
}
