import { AisleResult } from "../types/index.js";

interface AisleCardProps {
  aisle: AisleResult;
}

export function AisleCard({ aisle }: AisleCardProps) {
  const filledCategories = aisle.categories.filter((cat) => cat.items.length > 0);

  return (
    <div className="aisle-card">
      <h3 className="aisle-card-title">{aisle.name}</h3>
      {filledCategories.map((category) => (
        <div key={category.name} className="aisle-category">
          <span className="category-label">{category.name}</span>
          <ul className="aisle-card-items">
            {[...category.items].sort((a, b) => a.localeCompare(b)).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
