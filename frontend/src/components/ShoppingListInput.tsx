import { useState } from "react";
import { FAB } from "./FAB.js";
import { AddItemSheet } from "./AddItemSheet.js";

interface Props {
  items: string[];
  onRemoveItem: (index: number) => void;
  onAddItems: (items: string[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function ShoppingListInput({ items, onRemoveItem, onAddItems, onSubmit, isLoading }: Props) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <section className="shopping-input">
      <h2>My List</h2>

      {items.length === 0 ? (
        <p className="flat-list-empty">Tap + to start adding items</p>
      ) : (
        <ul className="flat-list">
          {items.map((item, i) => (
            <li key={i} className="flat-list-item">
              <span>{item}</span>
              <button
                className="flat-list-item__remove"
                onClick={() => onRemoveItem(i)}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <FAB onClick={() => setIsSheetOpen(true)} disabled={isLoading} />

      <AddItemSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onAddItems={onAddItems}
      />

      <button
        className="btn-primary btn-organize"
        onClick={onSubmit}
        disabled={items.length === 0 || isLoading}
      >
        {isLoading ? "Organizing..." : "Organize My List"}
      </button>
    </section>
  );
}
