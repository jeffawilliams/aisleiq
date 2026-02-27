import { CategoryResult } from "../types/index.js";

interface CategoryCardProps {
  category: CategoryResult;
  checkedItems: Set<string>;
  onToggle: (item: string) => void;
}

export function CategoryCard({ category, checkedItems, onToggle }: CategoryCardProps) {
  const sortedItems = [...category.items].sort((a, b) => a.localeCompare(b));

  return (
    <div className="aisle-card">
      <h3 className="aisle-card-title">{category.name}</h3>
      <ul className="aisle-card-items">
        {sortedItems.map((item) => {
          const isChecked = checkedItems.has(item);
          return (
            <li
              key={item}
              className={`checklist-item ${isChecked ? "checklist-item--checked" : ""}`}
              onClick={() => onToggle(item)}
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
