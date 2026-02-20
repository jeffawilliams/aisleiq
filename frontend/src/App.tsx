import { useState } from "react";
import { AisleManager } from "./components/AisleManager.js";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useCategorize } from "./hooks/useCategorize.js";

const DEFAULT_AISLES = [
  "Produce",
  "Dairy",
  "Meat & Seafood",
  "Bakery",
  "Frozen",
  "Pantry",
  "Beverages",
  "Personal Care",
  "Household",
];

export function App() {
  const [aisles, setAisles] = useState<string[]>(DEFAULT_AISLES);
  const { categorize, result, isLoading, error } = useCategorize();

  const handleAdd = (name: string) => setAisles((prev) => [...prev, name]);
  const handleRemove = (name: string) =>
    setAisles((prev) => prev.filter((a) => a !== name));

  const handleSubmit = (items: string) => {
    if (aisles.length === 0) return;
    categorize(aisles, items);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AisleIQ</h1>
        <p>Paste your shopping list. We'll sort it by aisle.</p>
      </header>

      <main className="app-main">
        <div className="input-panel">
          <AisleManager
            aisles={aisles}
            onAdd={handleAdd}
            onRemove={handleRemove}
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
