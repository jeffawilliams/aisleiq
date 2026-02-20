import { AisleResult } from "../types/index.js";

interface AisleCardProps {
  aisle: AisleResult;
}

export function AisleCard({ aisle }: AisleCardProps) {
  const filledCategories = aisle.categories.filter((cat) => cat.items.length > 0);
  const allItems = filledCategories
    .flatMap((cat) => cat.items)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="aisle-card">
      <h3 className="aisle-card-title">{aisle.name}</h3>
      <p className="aisle-category-summary">
        {filledCategories.map((cat) => cat.name).join(", ")}
      </p>
      <ul className="aisle-card-items">
        {allItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
