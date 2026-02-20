import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { StoreAisle } from "../types/index.js";

interface AisleManagerProps {
  aisles: StoreAisle[];
  onAddAisle: (name: string) => void;
  onRemoveAisle: (name: string) => void;
  onRenameAisle: (oldName: string, newName: string) => void;
  onAddCategory: (aisleName: string, category: string) => void;
  onRemoveCategory: (aisleName: string, category: string) => void;
}

export function AisleManager({
  aisles,
  onAddAisle,
  onRemoveAisle,
  onRenameAisle,
  onAddCategory,
  onRemoveCategory,
}: AisleManagerProps) {
  const [expandedAisle, setExpandedAisle] = useState<string | null>(null);
  const [aisleInput, setAisleInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [editingAisle, setEditingAisle] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingAisle !== null) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [editingAisle]);

  const startEditing = (aisleName: string) => {
    setEditingAisle(aisleName);
    setRenameInput(aisleName);
  };

  const commitRename = (oldName: string) => {
    onRenameAisle(oldName, renameInput);
    // If rename succeeded the aisle name changed; if not, just close edit mode
    setEditingAisle(null);
    // Keep expanded state in sync with new name if rename went through
    const trimmed = renameInput.trim();
    if (trimmed && trimmed !== oldName) {
      setExpandedAisle((prev) => (prev === oldName ? trimmed : prev));
    }
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, oldName: string) => {
    if (e.key === "Enter") commitRename(oldName);
    if (e.key === "Escape") setEditingAisle(null);
  };

  const handleAddAisle = () => {
    const trimmed = aisleInput.trim();
    if (trimmed && !aisles.find((a) => a.name === trimmed)) {
      onAddAisle(trimmed);
      setAisleInput("");
      setExpandedAisle(trimmed);
    }
  };

  const handleAisleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddAisle();
  };

  const handleAddCategory = (aisleName: string) => {
    const trimmed = (categoryInputs[aisleName] ?? "").trim();
    const aisle = aisles.find((a) => a.name === aisleName);
    if (trimmed && aisle && !aisle.categories.includes(trimmed)) {
      onAddCategory(aisleName, trimmed);
      setCategoryInputs((prev) => ({ ...prev, [aisleName]: "" }));
    }
  };

  const handleCategoryKeyDown = (e: KeyboardEvent<HTMLInputElement>, aisleName: string) => {
    if (e.key === "Enter") handleAddCategory(aisleName);
  };

  const toggleExpand = (aisleName: string) => {
    setExpandedAisle((prev) => (prev === aisleName ? null : aisleName));
  };

  return (
    <section className="aisle-manager">
      <h2>Store Layout</h2>
      <p className="hint">
        Define your store's aisles and categories. Click an aisle name to rename it.
      </p>

      <div className="aisle-accordion">
        {aisles.map((aisle) => {
          const isExpanded = expandedAisle === aisle.name;
          const isEditing = editingAisle === aisle.name;
          return (
            <div key={aisle.name} className="accordion-row">
              <div className="accordion-header">
                <button
                  className="accordion-arrow-btn"
                  onClick={() => toggleExpand(aisle.name)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${aisle.name}`}
                >
                  <span className={`accordion-arrow ${isExpanded ? "expanded" : ""}`}>▶</span>
                </button>

                {isEditing ? (
                  <input
                    ref={renameRef}
                    className="accordion-rename-input"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, aisle.name)}
                    onBlur={() => commitRename(aisle.name)}
                    maxLength={50}
                  />
                ) : (
                  <span
                    className="accordion-name"
                    onClick={() => startEditing(aisle.name)}
                    title="Click to rename"
                  >
                    {aisle.name}
                  </span>
                )}

                <span className="accordion-count">
                  {aisle.categories.length} {aisle.categories.length === 1 ? "category" : "categories"}
                </span>
                <button
                  className="accordion-remove"
                  onClick={() => onRemoveAisle(aisle.name)}
                  aria-label={`Remove ${aisle.name}`}
                >
                  ×
                </button>
              </div>

              {isExpanded && (
                <div className="accordion-body">
                  <div className="category-chips">
                    {aisle.categories.map((cat) => (
                      <span key={cat} className="chip chip-category">
                        {cat}
                        <button
                          className="chip-remove"
                          onClick={() => onRemoveCategory(aisle.name, cat)}
                          aria-label={`Remove ${cat}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="aisle-input-row">
                    <input
                      type="text"
                      value={categoryInputs[aisle.name] ?? ""}
                      onChange={(e) =>
                        setCategoryInputs((prev) => ({ ...prev, [aisle.name]: e.target.value }))
                      }
                      onKeyDown={(e) => handleCategoryKeyDown(e, aisle.name)}
                      placeholder="Add a category (e.g. Cereal)"
                      maxLength={50}
                    />
                    <button
                      onClick={() => handleAddCategory(aisle.name)}
                      disabled={!(categoryInputs[aisle.name] ?? "").trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="aisle-input-row aisle-add-row">
        <input
          type="text"
          value={aisleInput}
          onChange={(e) => setAisleInput(e.target.value)}
          onKeyDown={handleAisleKeyDown}
          placeholder="Add an aisle (e.g. Bakery)"
          maxLength={50}
        />
        <button onClick={handleAddAisle} disabled={!aisleInput.trim()}>
          Add Aisle
        </button>
      </div>
    </section>
  );
}
