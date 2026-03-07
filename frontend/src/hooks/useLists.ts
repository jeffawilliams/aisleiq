import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export interface ListRecord {
  id: string;
  name: string;
  items: string[];
  updated_at: string;
  share_token: string | null;
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
  generateShareLink: (listId: string) => Promise<void>;
  revokeShareLink: (listId: string) => Promise<void>;
} {
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsNaming, setNeedsNaming] = useState(false);

  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<string>("");
  const isRemoteUpdate = useRef(false);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeShareTokenRef = useRef<string | null>(null);

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
        .select("id, name, items, updated_at, share_token")
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

    saveTimer.current = setTimeout(async () => {
      const now = new Date().toISOString();
      await supabase
        .from("lists")
        .update({ items: listItems, updated_at: now })
        .eq("id", activeListId);

      lastSavedAt.current = now;

      // Broadcast to any open shared-link sessions (postgres_changes doesn't
      // reliably deliver events to anonymous Supabase subscribers)
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: "broadcast",
          event: "items_updated",
          payload: { items: listItems, updated_at: now },
        });
      }

      // Keep local lists state in sync with updated_at
      setLists(prev =>
        prev.map(l =>
          l.id === activeListId
            ? { ...l, items: listItems, updated_at: now }
            : l
        )
      );
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, user?.id, activeListId]);

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
          const incoming = payload.new as { items: string[]; updated_at: string };
          // Only apply if the change came from someone else (newer than our last save)
          if (incoming.updated_at > lastSavedAt.current) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            isRemoteUpdate.current = true;
            setListItems(incoming.items);
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
        setActiveListId(next.id);
        setListItems(next.items as string[]);
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

    setActiveListId(id);
    setListItems(target.items as string[]);
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
    listItems,
    setListItems,
    isLoaded,
    needsNaming,
    createList,
    deleteList,
    renameList,
    switchList,
    generateShareLink,
    revokeShareLink,
  };
}
