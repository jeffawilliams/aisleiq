import { CategorizeResponse } from "../types/index.js";
import { AisleCard } from "./AisleCard.js";

interface ResultsGridProps {
  result: CategorizeResponse;
}

export function ResultsGrid({ result }: ResultsGridProps) {
  const nonEmpty = result.aisles.filter((a) => a.categories.some((cat) => cat.items.length > 0));
  const empty = result.aisles.filter((a) => !a.categories.some((cat) => cat.items.length > 0));

  return (
    <section className="results">
      <h2>Organized List</h2>
      <div className="results-grid">
        {nonEmpty.map((aisle) => (
          <AisleCard key={aisle.name} aisle={aisle} />
        ))}
        {empty.map((aisle) => (
          <AisleCard key={aisle.name} aisle={aisle} />
        ))}
      </div>
    </section>
  );
}
