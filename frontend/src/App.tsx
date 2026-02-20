import { useState } from "react";
import { AisleManager } from "./components/AisleManager.js";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useCategorize } from "./hooks/useCategorize.js";
import { StoreAisle } from "./types/index.js";

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
  const [aisles, setAisles] = useState<StoreAisle[]>(DEFAULT_AISLES);
  const { categorize, result, isLoading, error } = useCategorize();

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
        <p>Paste your shopping list. We'll sort it by aisle and category.</p>
      </header>

      <main className="app-main">
        <div className="input-panel">
          <AisleManager
            aisles={aisles}
            onAddAisle={addAisle}
            onRemoveAisle={removeAisle}
            onRenameAisle={renameAisle}
            onAddCategory={addCategory}
            onRemoveCategory={removeCategory}
          />
          <ShoppingListInput onSubmit={handleSubmit} isLoading={isLoading} />
          {aisles.length === 0 && (
            <p className="warning">Add at least one aisle before organizing.</p>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        {isLoading && <LoadingSpinner />}

        {result && !isLoading && <ResultsGrid result={result} />}
      </main>
    </div>
  );
}
