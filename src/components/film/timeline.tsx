import type { Play } from "@/lib/core/types";
import { cn } from "@/lib/utils";

export function FilmTimeline({
  plays,
  durationSec,
  currentSec,
  selectedId,
  onSeek,
}: {
  plays: Play[];
  durationSec: number;
  currentSec: number;
  selectedId: string | null;
  onSeek: (sec: number, playId?: string) => void;
}) {
  const max = Math.max(durationSec, 1);

  return (
    <div className="space-y-2">
      <div className="relative h-12 rounded-[var(--radius-md)] border border-border bg-bg overflow-hidden">
        {/* yard-style hash marks */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-border"
              style={{ left: `${i * 10}%` }}
            />
          ))}
        </div>

        {plays.map((p) => {
          const left = (p.startSec / max) * 100;
          const width = Math.max(((p.endSec - p.startSec) / max) * 100, 0.4);
          const active = p.id === selectedId;
          const color =
            p.side === "offense"
              ? "bg-fg/50"
              : p.side === "defense"
                ? "bg-fg-muted/40"
                : "bg-warn/50";
          return (
            <button
              key={p.id}
              type="button"
              title={`Play ${p.index}`}
              onClick={() => onSeek(p.startSec, p.id)}
              className={cn(
                "absolute top-2 h-8 rounded-sm transition-opacity focus-ring",
                color,
                active ? "ring-1 ring-accent opacity-100" : "opacity-70 hover:opacity-100",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}

        <div
          className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-accent"
          style={{ left: `${Math.min(100, (currentSec / max) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] tabular text-fg-subtle">
        <span>0:00</span>
        <span>
          {Math.floor(max / 60)}:{(max % 60).toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
