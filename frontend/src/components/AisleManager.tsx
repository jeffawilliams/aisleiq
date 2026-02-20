import { useState, KeyboardEvent } from "react";

interface AisleManagerProps {
  aisles: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export function AisleManager({ aisles, onAdd, onRemove }: AisleManagerProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !aisles.includes(trimmed)) {
      onAdd(trimmed);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <section className="aisle-manager">
      <h2>Store Aisles</h2>
      <p className="hint">Define the aisles in your store. Items will be sorted into these categories.</p>
      <div className="aisle-chips">
        {aisles.map((aisle) => (
          <span key={aisle} className="chip">
            {aisle}
            <button
              className="chip-remove"
              onClick={() => onRemove(aisle)}
              aria-label={`Remove ${aisle}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="aisle-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an aisle (e.g. Bakery)"
          maxLength={50}
        />
        <button onClick={handleAdd} disabled={!input.trim()}>
          Add
        </button>
      </div>
    </section>
  );
}
