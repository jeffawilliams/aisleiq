import { CategoryResult, Deal } from "../types/index.js";

interface CategoryCardProps {
  category: CategoryResult;
  dealMap?: Map<string, Deal>;
  checked: Set<string>;
  onToggle: (item: string) => void;
  itemDealAccepted?: (boolean | null)[];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function CategoryCard({ category, dealMap, checked, onToggle, itemDealAccepted }: CategoryCardProps) {
  const sortedItems = [...category.items].sort((a, b) => a.localeCompare(b));

  return (
    <div className="aisle-card">
      <h3 className="aisle-card-title">{category.name}</h3>
      <ul className="aisle-card-items">
        {sortedItems.map((item, idx) => {
          const isChecked = checked.has(item);
          const deal = dealMap?.get(item.toLowerCase());
          const dealAccepted = itemDealAccepted?.[idx] ?? null;
          // Hide deal badge if user explicitly declined
          const showDeal = deal && dealAccepted !== false;
          return (
            <li
              key={item}
              className={`checklist-item ${isChecked ? "checklist-item--checked" : ""}`}
              onClick={() => onToggle(item)}
            >
              <span className="checklist-box">{isChecked ? "✓" : ""}</span>
              <span className="checklist-item__content">
                <span className="checklist-label">{item}</span>
                {showDeal && (
                  <span className={`deal-badge ${dealAccepted === true ? "deal-badge--claimed" : ""}`}>
                    <span className="deal-badge__product">
                      {dealAccepted === true ? "✓ " : ""}{deal.productName}
                    </span>
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
