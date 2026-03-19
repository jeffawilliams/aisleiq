import { useState } from "react";
import { CategoryResult, Deal } from "../types/index.js";

interface CategoryCardProps {
  category: CategoryResult;
  dealMap?: Map<string, Deal>;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function CategoryCard({ category, dealMap }: CategoryCardProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const sortedItems = [...category.items].sort((a, b) => a.localeCompare(b));

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

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
              onClick={() => toggle(item)}
            >
              <span className="checklist-box">{isChecked ? "✓" : ""}</span>
              <span className="checklist-label">{item}</span>
              {deal && (
                <span className="deal-badge">
                  <span className="deal-badge__product">{deal.productName}</span>
                  <span className="deal-badge__match">{deal.matchType}</span>
                  {deal.category && <span className="deal-badge__category"> · {deal.category}</span>}
                  <span className="deal-badge__price"> · Sale ${deal.promoPrice.toFixed(2)}</span>
                  <span className="deal-badge__savings"> · Save ${deal.savings.toFixed(2)}</span>
                  {deal.expiresAt && (
                    <span className="deal-badge__expiry"> · ends {formatDate(deal.expiresAt)}</span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
