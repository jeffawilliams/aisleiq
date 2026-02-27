import { useState } from "react";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useOrganize } from "./hooks/useCategorize.js";

export function App() {
  const { organize, result, isLoading, error } = useOrganize();
  const [listItems, setListItems] = useState<string[]>([]);
  const [isStale, setIsStale] = useState(false);

  const addItems = (newItems: string[]) => {
    setListItems(prev => [...prev, ...newItems.filter(i => i.trim())]);
    if (result) setIsStale(true);
  };

  const removeItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
    if (result) setIsStale(true);
  };

  const handleOrganize = () => {
    if (listItems.length > 0) {
      setIsStale(false);
      organize(listItems.join('\n'));
    }
  };

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
          onSubmit={handleOrganize}
          isLoading={isLoading}
          isStale={isStale}
        />
        {error && <p className="error">{error}</p>}
        {isLoading && <LoadingSpinner />}
        {result && !isLoading && <ResultsGrid result={result} isStale={isStale} />}
      </main>
    </div>
  );
}
