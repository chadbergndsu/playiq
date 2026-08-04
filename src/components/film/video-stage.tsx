import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Stylized film stage — demo does not stream real video files. */
export function VideoStage({
  title,
  opponent,
  hue,
  currentSec,
  durationSec,
  playing,
  playLabel,
  onToggle,
  onPrev,
  onNext,
}: {
  title: string;
  opponent: string;
  hue: number;
  currentSec: number;
  durationSec: number;
  playing: boolean;
  playLabel: string;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div
        className="relative aspect-video w-full"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, hsl(${hue} 14% 22%) 0%, #0a0b0d 70%)`,
        }}
      >
        {/* field silhouette */}
        <div className="pointer-events-none absolute inset-6 rounded-[var(--radius-md)] border border-fg/10 opacity-50">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-fg/15" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/15" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="absolute inset-y-2 w-px bg-fg/8"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}
        </div>

        <div className="absolute left-4 top-4 rounded-[var(--radius-sm)] bg-bg/70 px-2.5 py-1 text-xs text-fg-muted backdrop-blur-sm">
          Demo film stage · {title}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-semibold sm:text-4xl">{opponent}</p>
            <p className="text-sm text-fg-muted">{playLabel}</p>
          </div>
          <p className="rounded-[var(--radius-sm)] bg-bg/80 px-2 py-1 font-mono text-sm tabular">
            {formatClock(currentSec)} / {formatClock(durationSec)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-3">
        <Button type="button" variant="secondary" size="icon" onClick={onPrev} aria-label="Previous play">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button type="button" variant="primary" size="icon" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="secondary" size="icon" onClick={onNext} aria-label="Next play">
          <SkipForward className="h-4 w-4" />
        </Button>
        <p className="ml-auto text-xs text-fg-subtle">
          J / K play step · Space play/pause (when focused)
        </p>
      </div>
    </div>
  );
}
