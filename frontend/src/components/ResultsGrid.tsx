import { useState } from "react";
import { OrganizeResponse, Deal } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
  isStale: boolean;
  deals?: Deal[];
  ordered?: boolean;
  showDeals?: boolean;
  onToggleDeals?: (val: boolean) => void;
  isAdmin?: boolean;
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

export function ResultsGrid({ result, isStale, deals, ordered, showDeals = true, onToggleDeals, isAdmin = false }: ResultsGridProps) {
  const sorted = ordered ? result.categories : sortCategories(result.categories);
  const exactDeals = deals?.filter(d => d.matchType === "exact") ?? [];
  const hasAnyDeals = exactDeals.length > 0;
  const dealMap = new Map(
    (showDeals ? exactDeals : []).map(d => [d.listItem.toLowerCase(), d])
  );
  const [dealsBannerDismissed, setDealsBannerDismissed] = useState(() => {
    try { return localStorage.getItem("sla_deals_test_dismissed") === "true"; } catch { return false; }
  });

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
      {hasAnyDeals && onToggleDeals && (
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
      {hasAnyDeals && !dealsBannerDismissed && (
        <div className="test-banner">
          <span className="test-banner__text">
            <strong>Test feature.</strong> Deal prices are from a sandbox environment and are not real offers.
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
      <div className="results-grid">
        {sorted.map((category) => (
          <CategoryCard key={category.name} category={category} dealMap={dealMap} />
        ))}
      </div>
    </section>
  );
}
