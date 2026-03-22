import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export interface ListItem {
  text: string;
  photo?: string;
  quantity?: string;       // recipe quantity sub-label (e.g. "2 cups")
  source?: 'recipe';       // present only on recipe-imported items
  recipeName?: string;     // name of source recipe, for badge tooltip
}

export interface ListRecord {
  id: string;
  name: string;
  items: (string | ListItem)[];
  updated_at: string;
  share_token: string | null;
  store_id: number | null;
}

// Support both legacy string[] and new {text, photo?, quantity?, source?, recipeName?}[] formats
function splitItems(raw: (string | ListItem)[]): {
  texts: string[];
  photos: (string | null)[];
  quantities: (string | null)[];
  sources: ('recipe' | null)[];
  recipeNames: (string | null)[];
} {
  const texts: string[] = [];
  const photos: (string | null)[] = [];
  const quantities: (string | null)[] = [];
  const sources: ('recipe' | null)[] = [];
  const recipeNames: (string | null)[] = [];

  for (const item of raw) {
    if (typeof item === "string") {
      texts.push(item);
      photos.push(null);
      quantities.push(null);
      sources.push(null);
      recipeNames.push(null);
    } else {
      texts.push(item.text);
      photos.push(item.photo ?? null);
      quantities.push(item.quantity ?? null);
      sources.push(item.source ?? null);
      recipeNames.push(item.recipeName ?? null);
    }
  }
  return { texts, photos, quantities, sources, recipeNames };
}

function mergeItems(
  texts: string[],
  photos: (string | null)[],
  quantities: (string | null)[],
  sources: ('recipe' | null)[],
  recipeNames: (string | null)[]
): ListItem[] {
  return texts.map((text, i) => {
    const photo = photos[i] ?? null;
    const quantity = quantities[i] ?? null;
    const source = sources[i] ?? null;
    const recipeName = recipeNames[i] ?? null;

    const item: ListItem = { text };
    if (photo) item.photo = photo;
    if (quantity) item.quantity = quantity;
    if (source) item.source = source;
    if (recipeName) item.recipeName = recipeName;
    return item;
  });
}

const ACTIVE_LIST_KEY = "sla_active_list_id";
const PENDING_ITEMS_KEY = "sla_pending_items";

export function useLists(user: User | null): {
  lists: ListRecord[];
  activeListId: string | null;
  activeListName: string;
  activeStoreId: number | null;
  listItems: string[];
  setListItems: React.Dispatch<React.SetStateAction<string[]>>;
  itemPhotos: (string | null)[];
  setItemPhotos: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  itemQuantities: (string | null)[];
  setItemQuantities: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  itemSources: ('recipe' | null)[];
  setItemSources: React.Dispatch<React.SetStateAction<('recipe' | null)[]>>;
  itemRecipeNames: (string | null)[];
  setItemRecipeNames: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  isLoaded: boolean;
  needsNaming: boolean;
  createList: (name: string, items: string[]) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  switchList: (id: string) => void;
  generateShareLink: (listId: string) => Promise<void>;
  revokeShareLink: (listId: string) => Promise<void>;
  setListStore: (listId: string, storeId: number | null) => Promise<void>;
} {
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<string[]>([]);
  const [itemPhotos, setItemPhotos] = useState<(string | null)[]>([]);
  const [itemQuantities, setItemQuantities] = useState<(string | null)[]>([]);
  const [itemSources, setItemSources] = useState<('recipe' | null)[]>([]);
  const [itemRecipeNames, setItemRecipeNames] = useState<(string | null)[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsNaming, setNeedsNaming] = useState(false);

  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<string>("");
  const isRemoteUpdate = useRef(false);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeShareTokenRef = useRef<string | null>(null);

  // Derive active list name and store from state
  const activeList = lists.find(l => l.id === activeListId);
  const activeListName = activeList?.name ?? "My List";
  const activeStoreId = activeList?.store_id ?? null;

  // Load all lists on sign-in; clear on sign-out
  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      setLists([]);
      setActiveListId(null);
      setListItems([]);
      setItemPhotos([]);
      setItemQuantities([]);
      setItemSources([]);
      setItemRecipeNames([]);
      setIsLoaded(false);
      setNeedsNaming(false);
      return;
    }

    async function loadLists() {
      const { data } = await supabase
        .from("lists")
        .select("id, name, items, updated_at, share_token, store_id")
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
      const { texts, photos, quantities, sources, recipeNames } = splitItems(target.items);
      setActiveListId(target.id);
      setListItems(texts);
      setItemPhotos(photos);
      setItemQuantities(quantities);
      setItemSources(sources);
      setItemRecipeNames(recipeNames);
      lastSavedAt.current = target.updated_at;
      setIsLoaded(true);
      initialLoadDone.current = true;
    }

    loadLists();
  }, [user?.id]);

  // Auto-save active list items (debounced 800ms)
  useEffect(() => {
    if (!user || !initialLoadDone.current || !activeListId) return;

    // Skip save if this update came from an inbound sync — only save local changes
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);

    const merged = mergeItems(listItems, itemPhotos, itemQuantities, itemSources, itemRecipeNames);

    saveTimer.current = setTimeout(async () => {
      const now = new Date().toISOString();
      await supabase
        .from("lists")
        .update({ items: merged, updated_at: now })
        .eq("id", activeListId);

      lastSavedAt.current = now;

      // Broadcast to any open shared-link sessions (postgres_changes doesn't
      // reliably deliver events to anonymous Supabase subscribers)
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: "broadcast",
          event: "items_updated",
          payload: { items: merged, updated_at: now },
        });
      }

      // Keep local lists state in sync with updated_at
      setLists(prev =>
        prev.map(l =>
          l.id === activeListId
            ? { ...l, items: merged, updated_at: now }
            : l
        )
      );
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, itemPhotos, itemQuantities, itemSources, itemRecipeNames, user?.id, activeListId]);

  // Pad parallel arrays with nulls when listItems grows (e.g. after Supabase load or addItems)
  useEffect(() => {
    const len = listItems.length;

    setItemPhotos(prev => {
      if (prev.length >= len) return prev;
      return [...prev, ...Array(len - prev.length).fill(null)];
    });

    setItemQuantities(prev => {
      if (prev.length >= len) return prev;
      return [...prev, ...Array(len - prev.length).fill(null)];
    });

    setItemSources(prev => {
      if (prev.length >= len) return prev;
      return [...prev, ...Array(len - prev.length).fill(null)];
    });

    setItemRecipeNames(prev => {
      if (prev.length >= len) return prev;
      return [...prev, ...Array(len - prev.length).fill(null)];
    });
  }, [listItems.length]);

  // Broadcast channel — owner sends updates to anonymous shared-link sessions
  useEffect(() => {
    const shareToken = lists.find(l => l.id === activeListId)?.share_token ?? null;

    // No change to the token — nothing to do
    if (shareToken === activeShareTokenRef.current) return;

    // Clean up the old channel if the token changed or was revoked
    if (broadcastChannelRef.current) {
      supabase.removeChannel(broadcastChannelRef.current);
      broadcastChannelRef.current = null;
    }

    activeShareTokenRef.current = shareToken;
    if (!shareToken) return;

    const channel = supabase.channel(`list-${shareToken}`).subscribe();
    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
      activeShareTokenRef.current = null;
    };
  }, [activeListId, lists]);

  // Realtime subscription — inbound changes from collaborators on the active list
  useEffect(() => {
    if (!activeListId) return;

    const channel = supabase
      .channel(`owner-list-${activeListId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lists",
          filter: `id=eq.${activeListId}`,
        },
        (payload) => {
          const incoming = payload.new as { items: (string | ListItem)[]; updated_at: string };
          // Only apply if the change came from someone else (newer than our last save)
          if (incoming.updated_at > lastSavedAt.current) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            isRemoteUpdate.current = true;
            const { texts, photos, quantities, sources, recipeNames } = splitItems(incoming.items);
            setListItems(texts);
            setItemPhotos(photos);
            setItemQuantities(quantities);
            setItemSources(sources);
            setItemRecipeNames(recipeNames);
            lastSavedAt.current = incoming.updated_at;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeListId]);

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
      .select("id, name, items, updated_at, share_token")
      .single();

    if (error || !data) return;

    const newList = data as ListRecord;
    setLists(prev => [newList, ...prev]);
    setActiveListId(newList.id);
    setListItems(newList.items as string[]);
    setItemPhotos([]);
    setItemQuantities([]);
    setItemSources([]);
    setItemRecipeNames([]);
    lastSavedAt.current = newList.updated_at;
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
        const { texts, photos, quantities, sources, recipeNames } = splitItems(next.items);
        setActiveListId(next.id);
        setListItems(texts);
        setItemPhotos(photos);
        setItemQuantities(quantities);
        setItemSources(sources);
        setItemRecipeNames(recipeNames);
        lastSavedAt.current = next.updated_at;
        localStorage.setItem(ACTIVE_LIST_KEY, next.id);
      } else {
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

    const { texts, photos, quantities, sources, recipeNames } = splitItems(target.items);
    setActiveListId(id);
    setListItems(texts);
    setItemPhotos(photos);
    setItemQuantities(quantities);
    setItemSources(sources);
    setItemRecipeNames(recipeNames);
    lastSavedAt.current = target.updated_at;
    localStorage.setItem(ACTIVE_LIST_KEY, id);
  }

  async function generateShareLink(listId: string) {
    if (!user) return;

    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("lists")
      .update({ share_token: token })
      .eq("id", listId);

    if (error) return;

    setLists(prev =>
      prev.map(l => (l.id === listId ? { ...l, share_token: token } : l))
    );
  }

  async function setListStore(listId: string, storeId: number | null) {
    if (!user) return;

    await supabase
      .from("lists")
      .update({ store_id: storeId })
      .eq("id", listId);

    setLists(prev => prev.map(l => (l.id === listId ? { ...l, store_id: storeId } : l)));
  }

  async function revokeShareLink(listId: string) {
    if (!user) return;

    await supabase
      .from("lists")
      .update({ share_token: null })
      .eq("id", listId);

    setLists(prev =>
      prev.map(l => (l.id === listId ? { ...l, share_token: null } : l))
    );
  }

  return {
    lists,
    activeListId,
    activeListName,
    activeStoreId,
    listItems,
    setListItems,
    itemPhotos,
    setItemPhotos,
    itemQuantities,
    setItemQuantities,
    itemSources,
    setItemSources,
    itemRecipeNames,
    setItemRecipeNames,
    isLoaded,
    needsNaming,
    createList,
    deleteList,
    renameList,
    switchList,
    generateShareLink,
    revokeShareLink,
    setListStore,
  };
}
