import { useState } from "react";
import { CategoryResult } from "../types/index.js";

interface CategoryCardProps {
  category: CategoryResult;
}

export function CategoryCard({ category }: CategoryCardProps) {
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
