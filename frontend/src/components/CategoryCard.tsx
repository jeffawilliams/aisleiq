import { CategoryResult, Deal } from "../types/index.js";

interface CategoryCardProps {
  category: CategoryResult;
  dealMap?: Map<string, Deal>;
  checked: Set<string>;
  onToggle: (item: string) => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function CategoryCard({ category, dealMap, checked, onToggle }: CategoryCardProps) {
  const sortedItems = [...category.items].sort((a, b) => a.localeCompare(b));

  return (
    <div className="aisle-card">
      <h3 className="aisle-card-title">{category.name}</h3>
      <ul className="aisle-card-items">
        {sortedItems.map((item) => {
          const isChecked = checked.has(item);
          const deal = dealMap?.get(item.toLowerCase());
          return (
            <li
              key={item}
              className={`checklist-item ${isChecked ? "checklist-item--checked" : ""}`}
              onClick={() => onToggle(item)}
            >
              <span className="checklist-box">{isChecked ? "✓" : ""}</span>
              <span className="checklist-item__content">
                <span className="checklist-label">{item}</span>
                {deal && (
                  <span className="deal-badge">
                    <span className="deal-badge__product">{deal.productName}</span>
                    <span className="deal-badge__pricing">
                      Sale ${deal.promoPrice.toFixed(2)} (reg ${deal.regularPrice.toFixed(2)}) · Save ${deal.savings.toFixed(2)}{deal.expiresAt && ` · Expires ${formatDate(deal.expiresAt)}`}
                    </span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
