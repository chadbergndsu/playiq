import { Star } from "lucide-react";
import type { Play } from "@/lib/core/types";
import { cn, formatYards } from "@/lib/utils";

export function PlayList({
  plays,
  selectedId,
  onSelect,
}: {
  plays: Play[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (plays.length === 0) {
    return (
      <div className="panel p-6 text-center text-sm text-fg-muted">
        No plays match this filter.
      </div>
    );
  }

  return (
    <ul className="panel divide-y divide-border overflow-hidden">
      {plays.map((p) => {
        const concept =
          p.tags.find((t) => t.category === "concept")?.label ?? "—";
        const selected = p.id === selectedId;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors focus-ring",
                selected ? "bg-bg-subtle" : "hover:bg-bg-subtle/60",
              )}
            >
              <span className="w-8 shrink-0 tabular text-xs text-fg-subtle">
                {p.index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium capitalize">
                    {p.side}
                    {p.down != null ? ` · ${p.down}&${p.distance}` : ""}
                  </span>
                  {p.starred && (
                    <Star className="h-3 w-3 shrink-0 fill-warn text-warn" aria-label="Starred" />
                  )}
                </span>
                <span className="block truncate text-xs text-fg-muted">{concept}</span>
              </span>
              {p.yardsGained != null && (
                <span className="shrink-0 tabular text-xs text-fg-muted">
                  {formatYards(p.yardsGained)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
