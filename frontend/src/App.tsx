import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { useOrganize } from "./hooks/useCategorize.js";

export function App() {
  const { organize, result, isLoading, error } = useOrganize();

  return (
    <div className="app">
      <header className="app-header">
        <h1>ShoppingListAssist</h1>
        <p>Paste your grocery list. We'll organize it by category.</p>
      </header>

      <main className="app-main">
        <ShoppingListInput onSubmit={organize} isLoading={isLoading} />
        {error && <p className="error">{error}</p>}
        {isLoading && <LoadingSpinner />}
        {result && !isLoading && <ResultsGrid result={result} />}
      </main>
    </div>
  );
}
