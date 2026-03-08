import { useState } from "react";
import { FAB } from "./FAB.js";
import { AddItemSheet } from "./AddItemSheet.js";

interface Props {
  items: string[];
  onRemoveItem: (index: number) => void;
  onAddItems: (items: string[]) => void;
  onEditItem: (index: number, newValue: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isStale: boolean;
  listName: string;
  listBadge?: string;
}

export function ShoppingListInput({ items, onRemoveItem, onAddItems, onEditItem, onSubmit, isLoading, isStale, listName, listBadge }: Props) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [inlineValue, setInlineValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(index: number, currentValue: string) {
    setEditingIndex(index);
    setEditValue(currentValue);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== items[editingIndex]) {
      onEditItem(editingIndex, trimmed);
    }
    setEditingIndex(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { cancelEdit(); }
  }

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
      <h2>{listName}</h2>
      {listBadge && <span className="list-badge">{listBadge}</span>}

      {items.length > 0 && (
        <ul className="flat-list">
          {items.map((item, i) => (
            <li key={i} className="flat-list-item">
              {editingIndex === i ? (
                <input
                  className="flat-list-item__edit-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Edit ${item}`}
                />
              ) : (
                <span
                  className="flat-list-item__text"
                  onClick={() => startEdit(i, item)}
                >
                  {item}
                  {duplicateIndices.has(i) && (
                    <span className="flat-list-item__duplicate-badge">duplicate</span>
                  )}
                </span>
              )}
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
