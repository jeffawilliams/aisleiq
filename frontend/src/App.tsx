import { useState, useEffect, useRef } from "react";
import { AisleManager } from "./components/AisleManager.js";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useCategorize } from "./hooks/useCategorize.js";
import { StoreAisle } from "./types/index.js";

type View = "config" | "shop";

const DEFAULT_AISLES: StoreAisle[] = [
  { name: "Produce", categories: ["Vegetables", "Fruits", "Fresh Herbs"] },
  { name: "Dairy & Eggs", categories: ["Milk & Cream", "Cheese", "Yogurt", "Eggs"] },
  { name: "Meat & Seafood", categories: ["Beef & Pork", "Poultry", "Seafood"] },
  { name: "Bakery", categories: ["Bread & Rolls", "Pastries"] },
  { name: "Frozen", categories: ["Frozen Meals", "Frozen Vegetables", "Ice Cream"] },
  { name: "Canned & Packaged", categories: ["Canned Goods", "Packaged Dinners", "Soups"] },
  { name: "Breakfast", categories: ["Cereal", "Baking Supplies", "Syrup & Spreads"] },
  { name: "Beverages", categories: ["Water & Juice", "Soda", "Coffee & Tea"] },
  { name: "Personal Care", categories: ["Hair Care", "Skin Care", "Oral Care"] },
];

export function App() {
  const [view, setView] = useState<View>("shop");
  const [aisles, setAisles] = useState<StoreAisle[]>(DEFAULT_AISLES);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { categorize, result, isLoading, error } = useCategorize();

  // Fetch saved layout on mount
  useEffect(() => {
    fetch("/api/layout")
      .then((r) => r.json())
      .then((data) => {
        if (data.aisles && data.aisles.length > 0) {
          setAisles(data.aisles);
        }
      })
      .catch(() => {
        // fall back to defaults on error
      })
      .finally(() => setLayoutLoaded(true));
  }, []);

  // Save layout to DB whenever it changes (debounced, after initial load)
  useEffect(() => {
    if (!layoutLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch("/api/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aisles }),
      });
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [aisles, layoutLoaded]);

  const addAisle = (name: string) => {
    if (!aisles.find((a) => a.name === name)) {
      setAisles((prev) => [...prev, { name, categories: [] }]);
    }
  };

  const removeAisle = (name: string) => {
    setAisles((prev) => prev.filter((a) => a.name !== name));
  };

  const addCategory = (aisleName: string, category: string) => {
    setAisles((prev) =>
      prev.map((a) =>
        a.name === aisleName && !a.categories.includes(category)
          ? { ...a, categories: [...a.categories, category] }
          : a
      )
    );
  };

  const removeCategory = (aisleName: string, category: string) => {
    setAisles((prev) =>
      prev.map((a) =>
        a.name === aisleName
          ? { ...a, categories: a.categories.filter((c) => c !== category) }
          : a
      )
    );
  };

  const renameAisle = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || aisles.find((a) => a.name === trimmed)) return;
    setAisles((prev) => prev.map((a) => (a.name === oldName ? { ...a, name: trimmed } : a)));
  };

  const handleSubmit = (items: string) => {
    if (aisles.length === 0) return;
    categorize(aisles, items);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AisleIQ</h1>
        <nav className="mode-switcher">
          <button
            className={`mode-btn ${view === "shop" ? "active" : ""}`}
            onClick={() => setView("shop")}
          >
            Organize My List
          </button>
          <button
            className={`mode-btn ${view === "config" ? "active" : ""}`}
            onClick={() => setView("config")}
          >
            Configure Store
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === "config" && (
          <div className="config-view">
            <AisleManager
              aisles={aisles}
              onAddAisle={addAisle}
              onRemoveAisle={removeAisle}
              onRenameAisle={renameAisle}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
            />
          </div>
        )}

        {view === "shop" && (
          <div className="shop-view">
            <ShoppingListInput onSubmit={handleSubmit} isLoading={isLoading} />
            {aisles.length === 0 && (
              <p className="warning">No store layout configured. Switch to Configure Store to set up aisles.</p>
            )}
            {error && <p className="error">{error}</p>}
            {isLoading && <LoadingSpinner />}
            {result && !isLoading && <ResultsGrid result={result} />}
          </div>
        )}
      </main>
    </div>
  );
}
