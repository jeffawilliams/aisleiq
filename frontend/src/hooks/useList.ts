import { useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export function useList(
  user: User | null,
  listItems: string[],
  setListItems: React.Dispatch<React.SetStateAction<string[]>>
) {
  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load list when user signs in; clear it when they sign out
  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      setListItems([]);
      return;
    }

    async function loadList() {
      const { data } = await supabase
        .from("lists")
        .select("items")
        .eq("owner_id", user!.id)
        .maybeSingle();

      if (data) {
        // Returning user — load their saved list
        setListItems(data.items as string[]);
      }
      // New user with no saved list — keep whatever is in state already
      initialLoadDone.current = true;
    }

    loadList();
  }, [user?.id]);

  // Auto-save on change (debounced 800ms)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      await supabase
        .from("lists")
        .upsert(
          { owner_id: user.id, items: listItems, updated_at: new Date().toISOString() },
          { onConflict: "owner_id" }
        );
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, user?.id]);
}
