import { OrganizeResponse } from "../types/index.js";
import { CategoryCard } from "./CategoryCard.js";

interface ResultsGridProps {
  result: OrganizeResponse;
}

// Standard category order — common categories first, Other always last
const CATEGORY_ORDER = [
  "produce",
  "meat & seafood",
  "dairy & eggs",
  "bakery",
  "frozen",
  "canned & packaged",
  "pasta & rice",
  "breakfast",
  "snacks",
  "beverages",
  "condiments & sauces",
  "baking",
  "personal care",
  "household",
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
  const sorted = sortCategories(result.categories);

  return (
    <section className="results">
      <h2>Organized List</h2>
      <div className="results-grid">
        {sorted.map((category) => (
          <CategoryCard key={category.name} category={category} />
        ))}
      </div>
    </section>
  );
}
