import { useState } from "react";

interface Props {
  currentItems: string[];
  onCreate: (name: string) => void;
}

export function NameListModal({ currentItems, onCreate }: Props) {
  const [name, setName] = useState("My List");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave();
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Name your list</h3>
        <p className="modal-body">
          Give your list a name to get started.
          {currentItems.length > 0 && ` Your ${currentItems.length} item${currentItems.length === 1 ? "" : "s"} will be saved with it.`}
        </p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="List name"
        />
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!name.trim()}
          style={{ marginTop: "1rem" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
