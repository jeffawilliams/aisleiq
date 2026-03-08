import { useState } from "react";

interface ProductConfirmProps {
  item: string;
  photo?: string;
  onConfirm: (item: string) => void;
  onCancel: () => void;
}

export function ProductConfirm({ item, photo, onConfirm, onCancel }: ProductConfirmProps) {
  const [edited, setEdited] = useState(item);

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal">
        <h3>Does this look right?</h3>
        {photo && (
          <img
            className="confirm-modal-photo"
            src={`data:image/jpeg;base64,${photo}`}
            alt="Scanned product"
          />
        )}
        <input
          type="text"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          autoFocus
        />
        <div className="confirm-modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onConfirm(edited.trim())}
            disabled={!edited.trim()}
          >
            Add to list
          </button>
        </div>
      </div>
    </div>
  );
}
