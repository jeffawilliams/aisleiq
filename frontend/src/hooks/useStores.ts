import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { Store } from "../types/index.js";

export function useStores(): { stores: Store[]; isLoading: boolean } {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("stores")
        .select("id, name, kroger_location_id")
        .order("name");

      setStores((data as Store[]) ?? []);
      setIsLoading(false);
    }

    load();
  }, []);

  return { stores, isLoading };
}
