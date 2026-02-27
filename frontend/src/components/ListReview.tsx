import { useState } from "react";

interface ListReviewProps {
  items: string[];
  onConfirm: (items: string[]) => void;
  onCancel: () => void;
}

export function ListReview({ items, onConfirm, onCancel }: ListReviewProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set(items.map((_, i) => i)));

  const toggle = (index: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selected = items.filter((_, i) => checked.has(i));

  return (
    <div className="list-review-overlay">
      <div className="list-review">
        <h3>Review detected items</h3>
        <ul className="list-review-items">
          {items.map((item, i) => (
            <li
              key={i}
              className={`list-review-item${checked.has(i) ? ' list-review-item--checked' : ''}`}
              onClick={() => toggle(i)}
            >
              <span className="list-review-checkbox">
                {checked.has(i) ? '✓' : ''}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="list-review-actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
          >
            Add {selected.length} item{selected.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
