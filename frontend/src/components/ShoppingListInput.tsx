import { useState } from "react";
import { FAB } from "./FAB.js";
import { AddItemSheet } from "./AddItemSheet.js";

interface Props {
  items: string[];
  onRemoveItem: (index: number) => void;
  onAddItems: (items: string[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isStale: boolean;
}

export function ShoppingListInput({ items, onRemoveItem, onAddItems, onSubmit, isLoading, isStale }: Props) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [inlineValue, setInlineValue] = useState("");

  function handleInlineKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = inlineValue.trim();
      if (trimmed) {
        onAddItems([trimmed]);
        setInlineValue("");
      }
    }
  }

  const seen = new Set<string>();
  const duplicateIndices = new Set<number>();
  items.forEach((item, i) => {
    const key = item.trim().toLowerCase();
    if (seen.has(key)) {
      duplicateIndices.add(i);
    } else {
      seen.add(key);
    }
  });

  return (
    <section className="shopping-input">
      <h2>My List</h2>

      {items.length > 0 && (
        <ul className="flat-list">
          {items.map((item, i) => (
            <li key={i} className="flat-list-item">
              <span>
                {item}
                {duplicateIndices.has(i) && (
                  <span className="flat-list-item__duplicate-badge">duplicate</span>
                )}
              </span>
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

      <input
        type="text"
        className="inline-add-input"
        placeholder="Add an item..."
        value={inlineValue}
        onChange={(e) => setInlineValue(e.target.value)}
        onKeyDown={handleInlineKeyDown}
        disabled={isLoading}
      />

      <FAB onClick={() => setIsSheetOpen(true)} disabled={isLoading} />

      <AddItemSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onAddItems={onAddItems}
      />

      <button
        className={`btn-primary btn-organize${isStale ? " btn-organize--stale" : ""}`}
        onClick={onSubmit}
        disabled={items.length === 0 || isLoading}
      >
        {isLoading ? "Organizing..." : isStale ? "Re-organize" : "Organize My List"}
      </button>
    </section>
  );
}
