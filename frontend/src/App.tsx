import { useState, useEffect } from "react";
import { ShoppingListInput } from "./components/ShoppingListInput.js";
import { ResultsGrid } from "./components/ResultsGrid.js";
import { LoadingSpinner } from "./components/LoadingSpinner.js";
import { SignInModal } from "./components/SignInModal.js";
import { FeedbackModal } from "./components/FeedbackModal.js";
import { HamburgerMenu } from "./components/HamburgerMenu.js";
import { NameListModal } from "./components/NameListModal.js";
import { useOrganize } from "./hooks/useCategorize.js";
import { useOrganizeByAisle } from "./hooks/useOrganizeByAisle.js";
import { useAuth } from "./hooks/useAuth.js";
import { useLists } from "./hooks/useLists.js";
import { useStores } from "./hooks/useStores.js";
import { useDeals } from "./hooks/useDeals.js";
import { supabase } from "./lib/supabaseClient.js";

export function App() {
  const { organize, result, isLoading, error, reset } = useOrganize();
  const { organizeByAisle, result: aisleResult, isLoading: aisleLoading, error: aisleError, reset: resetAisle } = useOrganizeByAisle();
  const { user, role, authLoading, signIn, signInWithGoogle, signOut } = useAuth();
  const { stores } = useStores();
  const { deals, fetchDeals } = useDeals();
  const [isStale, setIsStale] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const {
    lists,
    activeListId,
    activeListName,
    activeStoreId,
    listItems,
    setListItems,
    itemPhotos,
    setItemPhotos,
    needsNaming,
    createList,
    deleteList,
    renameList,
    switchList,
    generateShareLink,
    revokeShareLink,
    setListStore,
  } = useLists(user);

  const isAdmin = role === "admin";
  const activeStore = isAdmin ? (stores.find(s => s.id === activeStoreId) ?? null) : null;

  // Clear results on sign-out
  useEffect(() => {
    if (!user) {
      reset();
      resetAisle();
    }
  }, [user]);

  // After either organize action resolves, fetch deals in the background if a store is selected
  useEffect(() => {
    if (result && activeStore?.kroger_location_id) {
      fetchDeals(listItems, activeStore.kroger_location_id);
    }
  }, [result]);

  useEffect(() => {
    if (aisleResult && activeStore?.kroger_location_id) {
      fetchDeals(listItems, activeStore.kroger_location_id);
    }
  }, [aisleResult]);

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

  const handleFeedback = async (category: string, message: string, email: string) => {
    const { error } = await supabase.from("feedback").insert({
      user_id: user?.id ?? null,
      email: email || null,
      category,
      message,
    });
    return { error };
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

  const handleOrganizeByAisle = () => {
    if (listItems.length > 0 && activeStoreId) {
      setIsStale(false);
      organizeByAisle(listItems.join("\n"), activeStoreId);
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
          stores={isAdmin ? stores : []}
          activeStoreId={activeStoreId}
          onSetListStore={(storeId) => activeListId && setListStore(activeListId, storeId)}
          onSignOut={signOut}
          onSelectList={switchList}
          onCreateList={(name) => createList(name, [])}
          onDeleteList={deleteList}
          onRenameList={renameList}
          onGenerateShareLink={generateShareLink}
          onRevokeShareLink={revokeShareLink}
          onOpenDashboard={() => { window.location.href = "/admin"; }}
          onSendFeedback={() => setShowFeedback(true)}
        />
      </header>

      <main className="app-main">
        <ShoppingListInput
          items={listItems}
          itemPhotos={itemPhotos}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onEditItem={editItem}
          onAddItemWithPhoto={addItemWithPhoto}
          onSubmit={handleOrganize}
          onOrganizeByAisle={handleOrganizeByAisle}
          isLoading={isLoading || aisleLoading}
          isStale={isStale}
          listName={activeListName}
          activeStore={activeStore}
        />
        {(error || aisleError) && <p className="error">{error ?? aisleError}</p>}
        {(isLoading || aisleLoading) && <LoadingSpinner />}
        {(result || aisleResult) && !(isLoading || aisleLoading) && (
          <ResultsGrid result={(aisleResult ?? result)!} isStale={isStale} deals={deals} ordered={!!aisleResult} />
        )}
      </main>

      {showSignIn && (
        <SignInModal
          onSignIn={signIn}
          onSignInWithGoogle={signInWithGoogle}
          onClose={() => setShowSignIn(false)}
        />
      )}

      {showFeedback && (
        <FeedbackModal
          onSubmit={handleFeedback}
          onClose={() => setShowFeedback(false)}
          userEmail={user?.email ?? null}
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
