import { useState } from "react";
import { AisleResult } from "../types/index.js";

interface AisleCardProps {
  aisle: AisleResult;
}

export function AisleCard({ aisle }: AisleCardProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const filledCategories = aisle.categories.filter((cat) => cat.items.length > 0);
  const allItems = filledCategories
    .flatMap((cat) => cat.items)
    .sort((a, b) => a.localeCompare(b));

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
      <h3 className="aisle-card-title">{aisle.name}</h3>
      <p className="aisle-category-summary">
        {filledCategories.map((cat) => cat.name).join(", ")}
      </p>
      <ul className="aisle-card-items">
        {allItems.map((item) => {
          const isChecked = checked.has(item);
          return (
            <li
              key={item}
              className={`checklist-item ${isChecked ? "checklist-item--checked" : ""}`}
              onClick={() => toggle(item)}
            >
              <span className="checklist-box">{isChecked ? "✓" : ""}</span>
              <span className="checklist-label">{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
