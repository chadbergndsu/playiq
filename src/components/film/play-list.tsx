import type { Play } from "@/lib/core/types";
import { cn, formatYards } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PlayList({
  plays,
  selectedId,
  onSelect,
}: {
  plays: Play[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-elevated">
      {plays.map((play) => {
        const active = play.id === selectedId;
        const concept = play.tags.find((t) => t.category === "concept");
        return (
          <li key={play.id}>
            <button
              type="button"
              onClick={() => onSelect(play.id)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors focus-ring",
                active ? "bg-bg-subtle" : "hover:bg-bg-subtle/60",
              )}
            >
              <span className="w-8 shrink-0 pt-0.5 text-xs tabular text-fg-subtle">
                {play.index}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium capitalize">{play.side}</span>
                  {play.down != null && (
                    <span className="text-xs tabular text-fg-muted">
                      {play.down}&{play.distance}
                    </span>
                  )}
                  {play.yardsGained != null && (
                    <span
                      className={cn(
                        "text-xs tabular font-medium",
                        play.yardsGained > 0
                          ? "text-success"
                          : play.yardsGained < 0
                            ? "text-danger"
                            : "text-fg-muted",
                      )}
                    >
                      {formatYards(play.yardsGained)}
                    </span>
                  )}
                  {play.result === "touchdown" && <Badge tone="success">TD</Badge>}
                  {play.result === "turnover" && <Badge tone="danger">TO</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-fg-muted">
                  Q{play.quarter} · {play.clock}
                  {concept ? ` · ${concept.label}` : ""}
                  {play.tags.length > 0 ? ` · ${play.tags.length} tags` : " · untagged"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
