import { useState, KeyboardEvent } from "react";
import { StoreAisle } from "../types/index.js";

interface AisleManagerProps {
  aisles: StoreAisle[];
  onAddAisle: (name: string) => void;
  onRemoveAisle: (name: string) => void;
  onAddCategory: (aisleName: string, category: string) => void;
  onRemoveCategory: (aisleName: string, category: string) => void;
}

export function AisleManager({
  aisles,
  onAddAisle,
  onRemoveAisle,
  onAddCategory,
  onRemoveCategory,
}: AisleManagerProps) {
  const [expandedAisle, setExpandedAisle] = useState<string | null>(null);
  const [aisleInput, setAisleInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});

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
        Define your store's aisles and categories. Items will be sorted into these categories.
      </p>

      <div className="aisle-accordion">
        {aisles.map((aisle) => {
          const isExpanded = expandedAisle === aisle.name;
          return (
            <div key={aisle.name} className="accordion-row">
              <div className="accordion-header">
                <button
                  className="accordion-toggle"
                  onClick={() => toggleExpand(aisle.name)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${aisle.name}`}
                >
                  <span className={`accordion-arrow ${isExpanded ? "expanded" : ""}`}>▶</span>
                  <span className="accordion-name">{aisle.name}</span>
                  <span className="accordion-count">
                    {aisle.categories.length} {aisle.categories.length === 1 ? "category" : "categories"}
                  </span>
                </button>
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
