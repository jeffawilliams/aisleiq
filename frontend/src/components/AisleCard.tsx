import { AisleResult } from "../types/index.js";

interface AisleCardProps {
  aisle: AisleResult;
}

export function AisleCard({ aisle }: AisleCardProps) {
  const hasItems = aisle.categories.some((cat) => cat.items.length > 0);

  return (
    <div className={`aisle-card ${hasItems ? "" : "empty"}`}>
      <h3 className="aisle-card-title">{aisle.name}</h3>
      {aisle.categories.map((category) => (
        <div
          key={category.name}
          className={`aisle-category ${category.items.length === 0 ? "category-empty" : ""}`}
        >
          <h4 className="category-name">{category.name}</h4>
          {category.items.length > 0 ? (
            <ul className="aisle-card-items">
              {category.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-label">No items</p>
          )}
        </div>
      ))}
      {!hasItems && aisle.categories.length === 0 && (
        <p className="empty-label">No items</p>
      )}
    </div>
  );
}
