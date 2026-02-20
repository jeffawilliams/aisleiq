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
          <h4 className="category-name">{category.name}</h4>
          <ul className="aisle-card-items">
            {category.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
