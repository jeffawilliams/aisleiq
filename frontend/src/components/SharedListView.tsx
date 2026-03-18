import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { ShoppingListInput } from "./ShoppingListInput.js";
import { ResultsGrid } from "./ResultsGrid.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import { useOrganize } from "../hooks/useCategorize.js";
import { useOrganizeByAisle } from "../hooks/useOrganizeByAisle.js";
import { useStores } from "../hooks/useStores.js";
import { useDeals } from "../hooks/useDeals.js";

interface ListItem {
  text: string;
  photo?: string;
}

function splitItems(raw: (string | ListItem)[]): { texts: string[]; photos: (string | null)[] } {
  const texts: string[] = [];
  const photos: (string | null)[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      texts.push(item);
      photos.push(null);
    } else {
      texts.push(item.text);
      photos.push(item.photo ?? null);
    }
  }
  return { texts, photos };
}

function mergeItems(texts: string[], photos: (string | null)[]): ListItem[] {
  return texts.map((text, i) => {
    const photo = photos[i] ?? null;
    return photo ? { text, photo } : { text };
  });
}

interface Props {
  token: string;
}

export function SharedListView({ token }: Props) {
  const { organize, result, isLoading: organizeLoading, error: organizeError } = useOrganize();
  const { organizeByAisle, result: aisleResult, isLoading: aisleLoading, error: aisleError } = useOrganizeByAisle();
  const { stores } = useStores();
  const { deals, fetchDeals } = useDeals();

  const [listId, setListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [storeId, setStoreId] = useState<number | null>(null);
  const [listItems, setListItems] = useState<string[]>([]);
  const [itemPhotos, setItemPhotos] = useState<(string | null)[]>([]);
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
      const { texts, photos } = splitItems(list.items as (string | ListItem)[]);
      setListId(list.id);
      setListName(list.name);
      setListItems(texts);
      setItemPhotos(photos);
      if (list.store_id) setStoreId(list.store_id);
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

    const merged = mergeItems(listItems, itemPhotos);

    saveTimer.current = setTimeout(async () => {
      const now = new Date().toISOString();
      await supabase.rpc("update_list_by_share_token", {
        token,
        new_items: merged,
      });
      lastSavedAt.current = now;
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [listItems, itemPhotos, listId]);

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
          const incoming = payload as { items: (string | ListItem)[]; updated_at: string };
          if (incoming.updated_at > lastSavedAt.current) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            isRemoteUpdate.current = true;
            const { texts, photos } = splitItems(incoming.items);
            setListItems(texts);
            setItemPhotos(photos);
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
    const filtered = newItems.filter(i => i.trim());
    setListItems(prev => [...prev, ...filtered]);
    setItemPhotos(prev => [...prev, ...filtered.map(() => null)]);
    if (result) setIsStale(true);
  };

  const addItemWithPhoto = (item: string, photo: string) => {
    setListItems(prev => [...prev, item]);
    setItemPhotos(prev => [...prev, photo]);
    if (result) setIsStale(true);
  };

  const removeItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
    setItemPhotos(prev => prev.filter((_, i) => i !== index));
    if (result) setIsStale(true);
  };

  const editItem = (index: number, newValue: string) => {
    setListItems(prev => prev.map((item, i) => i === index ? newValue : item));
    if (result) setIsStale(true);
  };

  const activeStore = stores.find(s => s.id === storeId) ?? null;

  // After organizing, fetch deals in the background if a store with Kroger ID is set
  useEffect(() => {
    if (result && activeStore?.kroger_location_id) {
      fetchDeals(listItems, activeStore.kroger_location_id);
    }
  }, [result]);

  const handleOrganize = () => {
    if (listItems.length > 0) {
      setIsStale(false);
      organize(listItems.join("\n"));
    }
  };

  const handleOrganizeByAisle = () => {
    if (listItems.length > 0 && storeId) {
      setIsStale(false);
      organizeByAisle(listItems.join("\n"), storeId);
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
          itemPhotos={itemPhotos}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onAddItemWithPhoto={addItemWithPhoto}
          onEditItem={editItem}
          onSubmit={handleOrganize}
          onOrganizeByAisle={handleOrganizeByAisle}
          isLoading={organizeLoading || aisleLoading}
          isStale={isStale}
          listName={listName}
          listBadge="Shared list"
          activeStore={activeStore}
        />
        {(organizeError || aisleError) && <p className="error">{organizeError ?? aisleError}</p>}
        {(organizeLoading || aisleLoading) && <LoadingSpinner />}
        {(result || aisleResult) && !(organizeLoading || aisleLoading) && (
          <ResultsGrid result={(aisleResult ?? result)!} isStale={isStale} deals={deals} />
        )}
      </main>
    </div>
  );
}
