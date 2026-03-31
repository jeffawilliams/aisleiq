import { useState, useEffect } from "react";
import { OrganizeResponse, Deal } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
  isStale: boolean;
  deals?: Deal[];
  hasStore?: boolean;
  ordered?: boolean;
  showDeals?: boolean;
  onToggleDeals?: (val: boolean) => void;
  isAdmin?: boolean;
  onCheckChange?: (dealCount: number, totalSavings: number) => void;
  onItemChecked?: (item: string, checked: boolean) => void;
  onDealResponse?: (item: string, accepted: boolean, dealProduct: string, dealSavings: number) => void;
  itemDealAccepted?: (boolean | null)[];
}

// Standard category order — common categories first, Other always last
const CATEGORY_ORDER = [
  "produce",
  "floral",
  "meat & seafood",
  "deli & prepared foods",
  "bakery",
  "dairy & eggs",
  "frozen",
  "beverages",
  "alcohol",
  "canned & packaged",
  "pasta, rice & grains",
  "condiments & dressings",
  "snacks",
  "breakfast & cereal",
  "baking",
  "international",
  "personal care",
  "household & cleaning",
  "paper products",
  "pet",
  "baby",
  "general merchandise",
];

function sortCategories(categories: OrganizeResponse["categories"]) {
  return [...categories].sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    if (aLower === "other") return 1;
    if (bLower === "other") return -1;
    const aIdx = CATEGORY_ORDER.indexOf(aLower);
    const bIdx = CATEGORY_ORDER.indexOf(bLower);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function ResultsGrid({ result, isStale, deals, hasStore = false, ordered, showDeals = true, onToggleDeals, isAdmin = false, onCheckChange, onItemChecked, onDealResponse, itemDealAccepted }: ResultsGridProps) {
  const sorted = ordered ? result.categories : sortCategories(result.categories);
  const exactDeals = deals?.filter(d => d.matchType === "exact") ?? [];
  const hasAnyDeals = exactDeals.length > 0;
  const dealMap = new Map(
    (showDeals ? exactDeals : []).map(d => [d.listItem.toLowerCase(), d])
  );
  const [dealsBannerDismissed, setDealsBannerDismissed] = useState(() => {
    try { return localStorage.getItem("sla_deals_test_dismissed") === "true"; } catch { return false; }
  });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dealPrompt, setDealPrompt] = useState<{ item: string; deal: Deal } | null>(null);

  // Reset checked state when results change (user re-organizes)
  useEffect(() => {
    setChecked(new Set());
  }, [result]);

  // Fire callback whenever checked state or deals change — skip if nothing checked yet
  useEffect(() => {
    if (!onCheckChange || checked.size === 0) return;
    const checkedLower = new Set([...checked].map(i => i.toLowerCase()));
    const checkedDeals = exactDeals.filter(d => checkedLower.has(d.listItem.toLowerCase()));
    const dealCount = checkedDeals.length;
    const totalSavings = checkedDeals.reduce((sum, d) => sum + d.savings, 0);
    onCheckChange(dealCount, totalSavings);
  }, [checked, exactDeals.length, onCheckChange]);

  function toggleItem(item: string) {
    const nowChecked = !checked.has(item);
    setChecked(prev => {
      const next = new Set(prev);
      if (nowChecked) next.add(item);
      else next.delete(item);
      return next;
    });
    onItemChecked?.(item, nowChecked);

    // If checking an item that has a deal, show acceptance prompt
    if (nowChecked && onDealResponse) {
      const deal = dealMap.get(item.toLowerCase());
      if (deal) setDealPrompt({ item, deal });
    }
  }

  function handleDealPromptResponse(accepted: boolean) {
    if (!dealPrompt) return;
    const { item, deal } = dealPrompt;
    if (accepted) {
      onDealResponse?.(item, true, deal.productName, deal.savings);
    } else {
      onDealResponse?.(item, false, deal.productName, deal.savings);
    }
    setDealPrompt(null);
  }

  function dismissDealsBanner() {
    setDealsBannerDismissed(true);
    try { localStorage.setItem("sla_deals_test_dismissed", "true"); } catch { /* ignore */ }
  }

  return (
    <section className="results">
      <div className="results-header">
        <h2>Organized List</h2>
        <button className="btn-print" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {hasStore && onToggleDeals && (
        <label className="deals-toggle">
          <input
            type="checkbox"
            className="deals-toggle__input"
            checked={showDeals}
            onChange={e => onToggleDeals(e.target.checked)}
          />
          <span className="deals-toggle__label">Show product deals</span>
        </label>
      )}
      {hasStore && !dealsBannerDismissed && (
        <div className="test-banner">
          <span className="test-banner__text">
            Product Deals use Test data and do not reflect current offers in-store.
          </span>
          <button className="test-banner__dismiss" onClick={dismissDealsBanner} aria-label="Dismiss">×</button>
        </div>
      )}
      {isStale && (
        <p className="stale-banner">
          {ordered
            ? "Your list has changed — tap Re-sort to update."
            : "Your list has changed — tap Re-group to update."}
        </p>
      )}
      {dealPrompt && (
        <div className="deal-prompt-overlay">
          <div className="deal-prompt">
            <p className="deal-prompt__text">
              Product <strong>{dealPrompt.deal.productName}</strong> added to cart?
            </p>
            <div className="deal-prompt__actions">
              <button className="deal-prompt__btn deal-prompt__btn--yes" onClick={() => handleDealPromptResponse(true)}>Yes</button>
              <button className="deal-prompt__btn deal-prompt__btn--no" onClick={() => handleDealPromptResponse(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      <div className="results-grid">
        {sorted.map((category) => (
          <CategoryCard key={category.name} category={category} dealMap={dealMap} checked={checked} onToggle={toggleItem} itemDealAccepted={itemDealAccepted} />
        ))}
      </div>
    </section>
  );
}
