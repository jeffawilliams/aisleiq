import { useState } from "react";

interface ShoppingListInputProps {
  onSubmit: (items: string) => void;
  isLoading: boolean;
}

export function ShoppingListInput({ onSubmit, isLoading }: ShoppingListInputProps) {
  const [items, setItems] = useState("");

  const handleSubmit = () => {
    if (items.trim()) onSubmit(items);
  };

  return (
    <section className="shopping-input">
      <h2>Shopping List</h2>
      <p className="hint">Paste or type your list — one item per line, or comma-separated.</p>
      <textarea
        value={items}
        onChange={(e) => setItems(e.target.value)}
        placeholder={"milk\napples\nfrozen peas\nbread\nolive oil"}
        rows={8}
        disabled={isLoading}
      />
      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!items.trim() || isLoading}
      >
        {isLoading ? "Organizing..." : "Organize My List"}
      </button>
    </section>
  );
}
