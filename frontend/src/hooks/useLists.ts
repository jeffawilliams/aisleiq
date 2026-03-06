import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export interface ListRecord {
  id: string;
  name: string;
  items: string[];
  updated_at: string;
}

const ACTIVE_LIST_KEY = "sla_active_list_id";
const PENDING_ITEMS_KEY = "sla_pending_items";

export function useLists(user: User | null): {
  lists: ListRecord[];
  activeListId: string | null;
  activeListName: string;
  listItems: string[];
  setListItems: React.Dispatch<React.SetStateAction<string[]>>;
  isLoaded: boolean;
  needsNaming: boolean;
  createList: (name: string, items: string[]) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  switchList: (id: string) => void;
} {
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsNaming, setNeedsNaming] = useState(false);

  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive active list name from state
  const activeList = lists.find(l => l.id === activeListId);
  const activeListName = activeList?.name ?? "My List";

  // Load all lists on sign-in; clear on sign-out
  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      setLists([]);
      setActiveListId(null);
      setListItems([]);
      setIsLoaded(false);
      setNeedsNaming(false);
      return;
    }

    async function loadLists() {
      const { data } = await supabase
        .from("lists")
        .select("id, name, items, updated_at")
        .eq("owner_id", user!.id)
        .order("updated_at", { ascending: false });

      if (!data || data.length === 0) {
        // New user — restore any items they added before signing in
        const pendingRaw = localStorage.getItem(PENDING_ITEMS_KEY);
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw);
            if (Array.isArray(pending) && pending.length > 0) {
              setListItems(pending);
            }
          } catch {}
        }
        setNeedsNaming(true);
        setIsLoaded(true);
        initialLoadDone.current = true;
        return;
      }

      const loadedLists = data as ListRecord[];
      setLists(loadedLists);

      // Restore last active list from localStorage, or fall back to most recently updated
      const savedId = localStorage.getItem(ACTIVE_LIST_KEY);
      const target = loadedLists.find(l => l.id === savedId) ?? loadedLists[0];
      setActiveListId(target.id);
      setListItems(target.items as string[]);
      setIsLoaded(true);
      initialLoadDone.current = true;
    }

    loadLists();
  }, [user?.id]);

  // Auto-save active list items (debounced 800ms)
  useEffect(() => {
    if (!user || !initialLoadDone.current || !activeListId) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      await supabase
        .from("lists")
        .update({ items: listItems, updated_at: new Date().toISOString() })
        .eq("id", activeListId);

      // Keep local lists state in sync with updated_at
      setLists(prev =>
        prev.map(l =>
          l.id === activeListId
            ? { ...l, items: listItems, updated_at: new Date().toISOString() }
            : l
        )
      );
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, user?.id, activeListId]);

  async function createList(name: string, items: string[]) {
    if (!user) return;

    const { data, error } = await supabase
      .from("lists")
      .insert({
        owner_id: user.id,
        name,
        items,
        updated_at: new Date().toISOString(),
      })
      .select("id, name, items, updated_at")
      .single();

    if (error || !data) return;

    const newList = data as ListRecord;
    setLists(prev => [newList, ...prev]);
    setActiveListId(newList.id);
    setListItems(newList.items as string[]);
    localStorage.setItem(ACTIVE_LIST_KEY, newList.id);
    localStorage.removeItem(PENDING_ITEMS_KEY);
    setNeedsNaming(false);
    initialLoadDone.current = true;
  }

  async function deleteList(id: string) {
    if (!user) return;

    await supabase.from("lists").delete().eq("id", id);

    const remaining = lists.filter(l => l.id !== id);
    setLists(remaining);

    if (activeListId === id) {
      if (remaining.length > 0) {
        const next = remaining[0];
        setActiveListId(next.id);
        setListItems(next.items as string[]);
        localStorage.setItem(ACTIVE_LIST_KEY, next.id);
      } else {
        // No lists left — auto-create a new one
        await createList("My List", []);
      }
    }
  }

  async function renameList(id: string, name: string) {
    if (!user) return;

    await supabase
      .from("lists")
      .update({ name })
      .eq("id", id);

    setLists(prev => prev.map(l => (l.id === id ? { ...l, name } : l)));
  }

  function switchList(id: string) {
    const target = lists.find(l => l.id === id);
    if (!target) return;

    setActiveListId(id);
    setListItems(target.items as string[]);
    localStorage.setItem(ACTIVE_LIST_KEY, id);
  }

  return {
    lists,
    activeListId,
    activeListName,
    listItems,
    setListItems,
    isLoaded,
    needsNaming,
    createList,
    deleteList,
    renameList,
    switchList,
  };
}
