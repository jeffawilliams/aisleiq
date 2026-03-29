import { useState, useEffect, useRef, useCallback } from "react";
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
  const { user, role, authLoading, isAnonymous, signIn, signInWithGoogle, signOut } = useAuth();
  const { stores } = useStores();
  const { deals, fetchDeals, resetDeals } = useDeals();
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
    itemQuantities,
    setItemQuantities,
    itemSources,
    setItemSources,
    itemRecipeNames,
    setItemRecipeNames,
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
  const activeStore = stores.find(s => s.id === activeStoreId) ?? null;
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckChange = useCallback((dealCount: number, totalSavings: number) => {
    if (!user || !activeListId) return;
    if (checkoutDebounceRef.current) clearTimeout(checkoutDebounceRef.current);
    checkoutDebounceRef.current = setTimeout(async () => {
      await supabase.from("checkout_events").upsert({
        user_id: user.id,
        list_id: activeListId,
        deal_count: dealCount,
        total_savings: totalSavings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,list_id" });
    }, 1500);
  }, [user, activeListId]);

  const [showDeals, setShowDeals] = useState(() => {
    try { return localStorage.getItem("sla_deals_show") !== "false"; } catch { return true; }
  });

  function toggleDeals(val: boolean) {
    setShowDeals(val);
    try { localStorage.setItem("sla_deals_show", String(val)); } catch { /* ignore */ }
  }

  // Write deals_shown = true whenever deals are on for the active list.
  // Handles both the default-on state and explicit toggle — safe to fire on
  // list switch since the flag is one-way (never reset to false).
  useEffect(() => {
    if (showDeals && activeListId && user) {
      supabase.from("lists").update({ deals_shown: true }).eq("id", activeListId);
    }
  }, [showDeals, activeListId]);

  // Clear results on sign-out (user transitions back to anonymous)
  useEffect(() => {
    if (!user || isAnonymous) {
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

  // Scroll to results after either organize action completes
  useEffect(() => {
    if ((result || aisleResult) && !(isLoading || aisleLoading)) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, aisleResult, isLoading, aisleLoading]);

  const addItems = (newItems: string[]) => {
    const filtered = newItems.filter(i => i.trim());
    setListItems(prev => [...prev, ...filtered]);
    setItemPhotos(prev => [...prev, ...filtered.map(() => null)]);
    if (result || aisleResult) setIsStale(true);
  };

  const addItemWithPhoto = (item: string, photo: string) => {
    setListItems(prev => [...prev, item]);
    setItemPhotos(prev => [...prev, photo]);
    if (result || aisleResult) setIsStale(true);
  };

  function handleAddRecipeItems(items: { name: string; quantity: string | null; recipeName: string | null }[]) {
    const names = items.map(i => i.name);
    const quantities = items.map(i => i.quantity);
    const recipeNames = items.map(i => i.recipeName);
    setListItems(prev => [...prev, ...names]);
    setItemQuantities(prev => [...prev, ...quantities]);
    setItemSources(prev => [...prev, ...items.map(() => 'recipe' as const)]);
    setItemRecipeNames(prev => [...prev, ...recipeNames]);
    if (result || aisleResult) setIsStale(true);
  }

  const removeItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
    setItemPhotos(prev => prev.filter((_, i) => i !== index));
    setItemQuantities(prev => prev.filter((_, i) => i !== index));
    setItemSources(prev => prev.filter((_, i) => i !== index));
    setItemRecipeNames(prev => prev.filter((_, i) => i !== index));
    if (result || aisleResult) setIsStale(true);
  };

  const editItem = (index: number, newValue: string) => {
    setListItems(prev => prev.map((item, i) => i === index ? newValue : item));
    if (result || aisleResult) setIsStale(true);
  };

  const editItemWithQuantity = (index: number, text: string, quantity: string | null) => {
    setListItems(prev => prev.map((item, i) => i === index ? text : item));
    setItemQuantities(prev => prev.map((q, i) => i === index ? quantity : q));
    if (result || aisleResult) setIsStale(true);
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
      resetAisle();
      const success = await organize(listItems.join("\n"));
      if (success && user && activeListId) {
        await supabase.from("organize_events").insert({
          user_id: user.id,
          list_id: activeListId,
          item_count: listItems.length,
          photo_item_count: itemPhotos.filter(p => p !== null).length,
          action_type: "group",
        });
      }
    }
  };

  const handleOrganizeByAisle = async () => {
    if (listItems.length > 0 && activeStoreId) {
      setIsStale(false);
      reset();
      const success = await organizeByAisle(listItems.join("\n"), activeStoreId);
      if (success && user && activeListId) {
        await supabase.from("organize_events").insert({
          user_id: user.id,
          list_id: activeListId,
          item_count: listItems.length,
          photo_item_count: itemPhotos.filter(p => p !== null).length,
          action_type: "sort",
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
            {!isAnonymous ? (
              <span className="auth-email">{user?.email}</span>
            ) : (
              <button
                className="btn-auth-link"
                onClick={() => setShowSignIn(true)}
              >
                Sign in to save your list
              </button>
            )}
          </div>
        )}
        <HamburgerMenu
          user={user}
          role={role}
          isAnonymous={isAnonymous}
          lists={lists}
          activeListId={activeListId}
          stores={stores}
          activeStoreId={activeStoreId}
          onSetListStore={(storeId) => { if (storeId === null) resetDeals(); activeListId && setListStore(activeListId, storeId); }}
          onSignOut={signOut}
          onSelectList={(id) => {
            if (id !== activeListId) { reset(); resetAisle(); resetDeals(); setIsStale(false); }
            switchList(id);
          }}
          onCreateList={(name) => { createList(name, []); reset(); resetAisle(); setIsStale(false); }}
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
          itemQuantities={itemQuantities}
          itemSources={itemSources}
          itemRecipeNames={itemRecipeNames}
          onRemoveItem={removeItem}
          onAddItems={addItems}
          onEditItem={editItem}
          onEditItemWithQuantity={editItemWithQuantity}
          onAddItemWithPhoto={addItemWithPhoto}
          onAddRecipeItems={handleAddRecipeItems}
          userId={user?.id}
          onSubmit={handleOrganize}
          onOrganizeByAisle={handleOrganizeByAisle}
          isGroupLoading={isLoading}
          isAisleLoading={aisleLoading}
          isStale={isStale}
          isAisleActive={!!aisleResult}
          listName={activeListName}
          activeStore={activeStore}
        />
        {(error || aisleError) && <p className="error">{error ?? aisleError}</p>}
        {(isLoading || aisleLoading) && <LoadingSpinner />}
        {(result || aisleResult) && !(isLoading || aisleLoading) && (
          <div ref={resultsRef}>
            <ResultsGrid
              result={(aisleResult ?? result)!}
              isStale={isStale}
              deals={deals}
              hasStore={!!activeStore}
              ordered={!!aisleResult}
              showDeals={showDeals}
              onToggleDeals={toggleDeals}
              isAdmin={isAdmin}
              onCheckChange={handleCheckChange}
            />
          </div>
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
