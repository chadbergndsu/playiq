import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Timer } from "lucide-react";
import type { Film } from "@/lib/core/types";
import { formatClock, plural } from "@/lib/utils";
import { FilmStatusBadge } from "./status-badge";

export function FilmCard({ film }: { film: Film }) {
  return (
    <Link
      to="/app/film/$filmId"
      params={{ filmId: film.id }}
      className="group panel motion-safe-fade flex flex-col overflow-hidden focus-ring hover:border-border-strong"
    >
      <div
        className="relative aspect-[16/9] border-b border-border"
        style={{
          background: `linear-gradient(145deg, hsl(${film.thumbnailHue} 12% 18%) 0%, hsl(${film.thumbnailHue} 8% 10%) 55%, #0a0b0d 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,transparent_0,transparent_calc(50%-0.5px),color-mix(in_oklab,var(--color-fg)_20%,transparent)_50%,transparent_calc(50%+0.5px),transparent_100%),linear-gradient(to_bottom,transparent_0,transparent_calc(50%-0.5px),color-mix(in_oklab,var(--color-fg)_12%,transparent)_50%,transparent_calc(50%+0.5px),transparent_100%)]" />
        <div className="absolute left-3 top-3">
          <FilmStatusBadge status={film.status} />
        </div>
        <div className="absolute bottom-3 right-3 rounded-[var(--radius-sm)] bg-bg/80 px-2 py-1 text-xs tabular text-fg-muted">
          {formatClock(film.durationSec)}
        </div>
        <div className="absolute bottom-3 left-3 font-display text-2xl font-semibold text-fg/90">
          W{film.week}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight group-hover:text-accent">
            {film.title}
          </h3>
          <p className="mt-0.5 text-sm text-fg-muted">
            {film.season} · {film.level}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {film.date}
          </span>
          <span className="inline-flex items-center gap-1 capitalize">
            <MapPin className="h-3.5 w-3.5" />
            {film.venue}
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" />
            {plural(film.playCount, "play")} · {plural(film.tagCount, "tag")}
          </span>
        </div>
        {film.status === "processing" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full rounded-full bg-fg-muted/60"
              style={{ width: `${film.aiProgress}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
