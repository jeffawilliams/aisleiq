import { AisleResult, CategorizeResponse } from "../types/index.js";
import { AisleCard } from "./AisleCard.js";

interface ResultsGridProps {
  result: CategorizeResponse;
}

function sortAisles(aisles: AisleResult[]): AisleResult[] {
  const isNumbered = (name: string) => /^\d|^aisle\s+\d/i.test(name);
  const isOther = (name: string) => name.toLowerCase() === "other";

  const numbered = aisles.filter((a) => isNumbered(a.name));
  const other = aisles.filter((a) => isOther(a.name));
  const general = aisles.filter((a) => !isNumbered(a.name) && !isOther(a.name));

  numbered.sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] ?? "0");
    const numB = parseInt(b.name.match(/\d+/)?.[0] ?? "0");
    return numA - numB;
  });

  general.sort((a, b) => a.name.localeCompare(b.name));

  return [...numbered, ...general, ...other];
}

export function ResultsGrid({ result }: ResultsGridProps) {
  const nonEmpty = result.aisles.filter((a) => a.categories.some((cat) => cat.items.length > 0));
  const sorted = sortAisles(nonEmpty);

  return (
    <section className="results">
      <h2>Organized List</h2>
      <div className="results-grid">
        {sorted.map((aisle) => (
          <AisleCard key={aisle.name} aisle={aisle} />
        ))}
      </div>
    </section>
  );
}
