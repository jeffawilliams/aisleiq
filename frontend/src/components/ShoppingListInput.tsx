import { useState } from "react";
import { FAB } from "./FAB.js";
import { AddItemSheet } from "./AddItemSheet.js";
import { Store } from "../types/index.js";

interface Props {
  items: string[];
  itemPhotos?: (string | null)[];
  onRemoveItem: (index: number) => void;
  onAddItems: (items: string[]) => void;
  onEditItem: (index: number, newValue: string) => void;
  onAddItemWithPhoto?: (item: string, photo: string) => void;
  onSubmit: () => void;
  onOrganizeByAisle?: () => void;
  isGroupLoading: boolean;
  isAisleLoading: boolean;
  isStale: boolean;
  listName: string;
  listBadge?: string;
  activeStore?: Store | null;
}

export function ShoppingListInput({ items, itemPhotos, onRemoveItem, onAddItems, onEditItem, onAddItemWithPhoto, onSubmit, onOrganizeByAisle, isGroupLoading, isAisleLoading, isStale, listName, listBadge, activeStore }: Props) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [inlineValue, setInlineValue] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCoachMark, setShowCoachMark] = useState(() => {
    try { return !localStorage.getItem("groupListCoachMarkDismissed"); } catch { return false; }
  });

  function dismissCoachMark() {
    try { localStorage.setItem("groupListCoachMarkDismissed", "1"); } catch { /* ignore */ }
    setShowCoachMark(false);
  }

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
              {itemPhotos?.[i] && editingIndex !== i && (
                <button
                  className="flat-list-item__photo-btn"
                  onClick={() => setLightboxPhoto(itemPhotos![i])}
                  aria-label={`View photo for ${item}`}
                >
                  🖼️
                </button>
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
        disabled={isGroupLoading || isAisleLoading}
      />

      <FAB onClick={() => setIsSheetOpen(true)} disabled={isGroupLoading || isAisleLoading} />

      <AddItemSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onAddItems={onAddItems}
        onAddItemWithPhoto={onAddItemWithPhoto}
      />

      {lightboxPhoto && (
        <div className="photo-lightbox" onClick={() => setLightboxPhoto(null)}>
          <button className="photo-lightbox__close" onClick={() => setLightboxPhoto(null)}>×</button>
          <img
            className="photo-lightbox__img"
            src={`data:image/jpeg;base64,${lightboxPhoto}`}
            alt="Product photo"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="organize-sticky">
        {showCoachMark && items.length > 0 && (
          <div className="organize-coach-hint">
            <span className="organize-coach-hint__text">✨ Group items by category for easier shopping</span>
            <button className="organize-coach-hint__dismiss" onClick={dismissCoachMark} aria-label="Dismiss tip">✕</button>
          </div>
        )}
        <div className="organize-sticky__actions">
          {activeStore && (
            <button
              className="btn-secondary btn-aisle"
              onClick={onOrganizeByAisle}
              disabled={items.length === 0 || isAisleLoading || isGroupLoading}
            >
              {isAisleLoading ? "Sorting..." : "Sort by Aisle"}
            </button>
          )}
          <button
            className={`btn-primary btn-organize${isStale ? " btn-organize--stale" : ""}`}
            onClick={onSubmit}
            disabled={items.length === 0 || isGroupLoading || isAisleLoading}
          >
            {isGroupLoading ? "Grouping..." : isStale ? "Re-group" : "Group My List"}
          </button>
        </div>
      </div>
    </section>
  );
}
