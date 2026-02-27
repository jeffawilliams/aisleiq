import { useState } from "react";
import { OrganizeResponse } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
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

export function ResultsGrid({ result }: ResultsGridProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const sorted = sortCategories(result.categories);

  const toggleItem = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const clearAll = () => setCheckedItems(new Set());

  return (
    <section className="results">
      <div className="results-header">
        <h2>Organized List</h2>
        {checkedItems.size > 0 && (
          <button className="btn-clear-checks" onClick={clearAll}>
            New trip
          </button>
        )}
      </div>
      <div className="results-grid">
        {sorted.map((category) => (
          <CategoryCard
            key={category.name}
            category={category}
            checkedItems={checkedItems}
            onToggle={toggleItem}
          />
        ))}
      </div>
    </section>
  );
}
