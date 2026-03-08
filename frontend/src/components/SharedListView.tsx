import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { ShoppingListInput } from "./ShoppingListInput.js";
import { ResultsGrid } from "./ResultsGrid.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import { useOrganize } from "../hooks/useCategorize.js";

interface Props {
  token: string;
}

export function SharedListView({ token }: Props) {
  const { organize, result, isLoading: organizeLoading, error: organizeError } = useOrganize();

  const [listId, setListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [listItems, setListItems] = useState<string[]>([]);
  const [isStale, setIsStale] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<string>("");
  const isRemoteUpdate = useRef(false);

  // Load the list by token on mount
  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc("get_list_by_share_token", { token });

      if (!data || data.length === 0) {
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      const list = data[0];
      setListId(list.id);
      setListName(list.name);
      setListItems(list.items as string[]);
      lastSavedAt.current = list.updated_at;
      setIsLoading(false);
      initialLoadDone.current = true;
    }

    load();
  }, [token]);

  // Debounced save via token-based RPC
  useEffect(() => {
    if (!initialLoadDone.current || !listId) return;

    // Skip save if this update came from an inbound sync — only save local changes
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const now = new Date().toISOString();
      await supabase.rpc("update_list_by_share_token", {
        token,
        new_items: listItems,
      });
      lastSavedAt.current = now;
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, listId]);

  // Broadcast subscription — receives live updates from the owner.
  // We use Broadcast instead of postgres_changes because Supabase does not
  // reliably deliver postgres_changes events to anonymous (unauthenticated)
  // subscribers even when an anon SELECT RLS policy is in place.
  useEffect(() => {
    const channel = supabase
      .channel(`list-${token}`)
      .on(
        "broadcast",
        { event: "items_updated" },
        ({ payload }) => {
          const incoming = payload as { items: string[]; updated_at: string };
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
  }, [token]);

  const addItems = (newItems: string[]) => {
    setListItems(prev => [...prev, ...newItems.filter(i => i.trim())]);
    if (result) setIsStale(true);
  };

  const removeItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
    if (result) setIsStale(true);
  };

  const editItem = (index: number, newValue: string) => {
    setListItems(prev => prev.map((item, i) => i === index ? newValue : item));
    if (result) setIsStale(true);
  };

  const handleOrganize = () => {
    if (listItems.length > 0) {
      setIsStale(false);
      organize(listItems.join("\n"));
    }
  };

  if (isLoading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Shopping List <em>Assist</em></h1>
        </header>
        <main className="app-main">
          <LoadingSpinner />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Shopping List <em>Assist</em></h1>
          <p>Add your groceries. We'll organize them.</p>
        </header>
        <main className="app-main">
          <div className="shared-list-unavailable">
            <p className="shared-list-unavailable__title">This list is no longer available.</p>
            <p className="shared-list-unavailable__body">
              The owner may have stopped sharing it. Ask them for a new link.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ShoppingListAssist</h1>
        <p>Add your groceries. We'll organize them.</p>
      </header>

      <main className="app-main">
        <ShoppingListInput
          items={listItems}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onEditItem={editItem}
          onSubmit={handleOrganize}
          isLoading={organizeLoading}
          isStale={isStale}
          listName={listName}
          listBadge="Shared list"
        />
        {organizeError && <p className="error">{organizeError}</p>}
        {organizeLoading && <LoadingSpinner />}
        {result && !organizeLoading && <ResultsGrid result={result} isStale={isStale} />}
      </main>
    </div>
  );
}
