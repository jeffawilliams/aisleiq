import { useState } from "react";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useOrganize } from "./hooks/useCategorize.js";

export function App() {
  const { organize, result, isLoading, error } = useOrganize();
  const [listItems, setListItems] = useState<string[]>([]);

  const addItems = (newItems: string[]) =>
    setListItems(prev => [...prev, ...newItems.filter(i => i.trim())]);

  const removeItem = (index: number) =>
    setListItems(prev => prev.filter((_, i) => i !== index));

  const handleOrganize = () => {
    if (listItems.length > 0) organize(listItems.join('\n'));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AisleIQ</h1>
        <p>Add your groceries. We'll organize them by aisle.</p>
      </header>

      <main className="app-main">
        <ShoppingListInput
          items={listItems}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onSubmit={handleOrganize}
          isLoading={isLoading}
        />
        {error && <p className="error">{error}</p>}
        {isLoading && <LoadingSpinner />}
        {result && !isLoading && <ResultsGrid result={result} />}
      </main>
    </div>
  );
}
