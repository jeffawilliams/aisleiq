import { useState } from "react";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { SignInModal } from "./components/SignInModal.js";
import { HamburgerMenu } from "./components/HamburgerMenu.js";
import { NameListModal } from "./components/NameListModal.js";
import { useOrganize } from "./hooks/useCategorize.js";
import { useAuth } from "./hooks/useAuth.js";
import { useLists } from "./hooks/useLists.js";

export function App() {
  const { organize, result, isLoading, error } = useOrganize();
  const { user, authLoading, signIn, signOut } = useAuth();
  const [isStale, setIsStale] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const {
    lists,
    activeListId,
    activeListName,
    listItems,
    setListItems,
    needsNaming,
    createList,
    deleteList,
    renameList,
    switchList,
  } = useLists(user);

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
        {!authLoading && (
          <div className="auth-bar">
            {user ? (
              <span className="auth-email">{user.email}</span>
            ) : (
              <button
                className="btn-auth-link"
                onClick={() => {
                  if (listItems.length > 0) {
                    localStorage.setItem("sla_pending_items", JSON.stringify(listItems));
                  }
                  setShowSignIn(true);
                }}
              >
                Sign in to save your list
              </button>
            )}
          </div>
        )}
        <HamburgerMenu
          user={user}
          lists={lists}
          activeListId={activeListId}
          onSignOut={signOut}
          onSelectList={switchList}
          onCreateList={(name) => createList(name, [])}
          onDeleteList={deleteList}
          onRenameList={renameList}
        />
      </header>

      <main className="app-main">
        <ShoppingListInput
          items={listItems}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onSubmit={handleOrganize}
          isLoading={isLoading}
          isStale={isStale}
          listName={activeListName}
        />
        {error && <p className="error">{error}</p>}
        {isLoading && <LoadingSpinner />}
        {result && !isLoading && <ResultsGrid result={result} isStale={isStale} />}
      </main>

      {showSignIn && (
        <SignInModal
          onSignIn={signIn}
          onClose={() => setShowSignIn(false)}
        />
      )}

      {needsNaming && (
        <NameListModal
          currentItems={listItems}
          onCreate={(name) => createList(name, listItems)}
        />
      )}
    </div>
  );
}
