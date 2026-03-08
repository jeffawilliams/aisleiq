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
import { supabase } from "./lib/supabaseClient.js";

export function App() {
  const { organize, result, isLoading, error } = useOrganize();
  const { user, role, authLoading, signIn, signOut } = useAuth();
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
    generateShareLink,
    revokeShareLink,
  } = useLists(user);

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

  const handleOrganize = async () => {
    if (listItems.length > 0) {
      setIsStale(false);
      const success = await organize(listItems.join("\n"));
      if (success && user && activeListId) {
        await supabase.from("organize_events").insert({
          user_id: user.id,
          list_id: activeListId,
          item_count: listItems.length,
        });
      }
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Shopping List <em>Assist</em></h1>
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
          role={role}
          lists={lists}
          activeListId={activeListId}
          onSignOut={signOut}
          onSelectList={switchList}
          onCreateList={(name) => createList(name, [])}
          onDeleteList={deleteList}
          onRenameList={renameList}
          onGenerateShareLink={generateShareLink}
          onRevokeShareLink={revokeShareLink}
          onOpenDashboard={() => { window.location.href = "/admin"; }}
        />
      </header>

      <main className="app-main">
        <ShoppingListInput
          items={listItems}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onEditItem={editItem}
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

      <span className="version-badge">v{__APP_VERSION__}</span>
    </div>
  );
}
