import { AisleResult } from "../types/index.js";

interface AisleCardProps {
  aisle: AisleResult;
}

export function AisleCard({ aisle }: AisleCardProps) {
  return (
    <div className={`aisle-card ${aisle.items.length === 0 ? "empty" : ""}`}>
      <h3 className="aisle-card-title">{aisle.name}</h3>
      {aisle.items.length > 0 ? (
        <ul className="aisle-card-items">
          {aisle.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-label">No items</p>
      )}
    </div>
  );
}
