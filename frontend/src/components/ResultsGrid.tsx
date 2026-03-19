import { OrganizeResponse, Deal } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
  isStale: boolean;
  deals?: Deal[];
  ordered?: boolean;
  showExactDeals?: boolean;
  showRelatedDeals?: boolean;
  onToggleExact?: (val: boolean) => void;
  onToggleRelated?: (val: boolean) => void;
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

export function ResultsGrid({ result, isStale, deals, ordered, showExactDeals = true, showRelatedDeals = true, onToggleExact, onToggleRelated }: ResultsGridProps) {
  const sorted = ordered ? result.categories : sortCategories(result.categories);
  const hasAnyDeals = (deals?.length ?? 0) > 0;
  const filteredDeals = deals?.filter(d =>
    (d.matchType === "exact" && showExactDeals) ||
    (d.matchType === "general" && showRelatedDeals)
  );
  const dealMap = new Map(filteredDeals?.map(d => [d.listItem.toLowerCase(), d]));

  return (
    <section className="results">
      <div className="results-header">
        <h2>Organized List</h2>
        <button className="btn-print" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {hasAnyDeals && onToggleExact && onToggleRelated && (
        <div className="deals-filter">
          <span className="deals-filter__label">Deals</span>
          <button
            className={`deals-filter__pill${showExactDeals ? " deals-filter__pill--active" : ""}`}
            onClick={() => onToggleExact(!showExactDeals)}
          >
            Exact matches
          </button>
          <button
            className={`deals-filter__pill${showRelatedDeals ? " deals-filter__pill--active" : ""}`}
            onClick={() => onToggleRelated(!showRelatedDeals)}
          >
            Related deals
          </button>
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
