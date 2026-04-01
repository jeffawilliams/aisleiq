import { useState } from "react";
import { OrganizeResponse } from "../types/index.js";

export function useOrganize() {
  const [result, setResult] = useState<OrganizeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organize = async (items: string): Promise<OrganizeResponse | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      const organized = data as OrganizeResponse;
      setResult(organized);
      return organized;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); };
  const restore = (r: OrganizeResponse) => { setResult(r); setError(null); };

  return { organize, result, isLoading, error, reset, restore };
}
