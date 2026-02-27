import { OrganizeResponse } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
  isStale: boolean;
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

export function ResultsGrid({ result, isStale }: ResultsGridProps) {
  const sorted = sortCategories(result.categories);

  return (
    <section className="results">
      <div className="results-header">
        <h2>Organized List</h2>
        <button className="btn-print" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {isStale && (
        <p className="stale-banner">
          Your list has changed — tap Re-organize to update.
        </p>
      )}
      <div className="results-grid">
        {sorted.map((category) => (
          <CategoryCard key={category.name} category={category} />
        ))}
      </div>
    </section>
  );
}
