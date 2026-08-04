import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { PlayList } from "@/components/film/play-list";
import { cutupDurationSec } from "@/lib/core/cutups";
import { cutupPlays, usePlayiqStore } from "@/lib/store/playiq-store";
import { formatClock, formatYards, plural } from "@/lib/utils";

export const Route = createFileRoute("/app/cutups/$cutupId")({
  component: CutupDetailPage,
});

function CutupDetailPage() {
  const { cutupId } = Route.useParams();
  const cutups = usePlayiqStore((s) => s.cutups);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const films = usePlayiqStore((s) => s.films);
  const selectPlay = usePlayiqStore((s) => s.selectPlay);

  const cutup = useMemo(() => cutups.find((c) => c.id === cutupId), [cutups, cutupId]);
  const plays = useMemo(
    () => cutupPlays(playsByFilm, cutups, cutupId),
    [playsByFilm, cutups, cutupId],
  );
  const allPlays = useMemo(() => Object.values(playsByFilm).flat(), [playsByFilm]);

  if (!cutup) {
    return (
      <div className="panel p-10 text-center text-sm text-fg-muted">
        Cutup not found.{" "}
        <Link to="/app/cutups" className="underline">
          Back
        </Link>
      </div>
    );
  }

  const duration = cutupDurationSec(allPlays, cutup.playIds);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          to="/app/cutups"
          className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg-muted hover:text-fg focus-ring"
          aria-label="Back to cutups"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {cutup.title}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {cutup.description || cutup.filterSummary} · {plural(plays.length, "play")} ·{" "}
            {formatClock(duration)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <PlayList plays={plays} selectedId={null} onSelect={(id) => selectPlay(id)} />
        <div className="panel divide-y divide-border overflow-hidden">
          {plays.map((p) => {
            const film = films.find((f) => f.id === p.filmId);
            return (
              <Link
                key={p.id}
                to="/app/film/$filmId"
                params={{ filmId: p.filmId }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-bg-subtle focus-ring"
                onClick={() => selectPlay(p.id)}
              >
                <div>
                  <p className="font-medium">
                    {film?.title ?? p.filmId} · Play {p.index}
                  </p>
                  <p className="text-xs capitalize text-fg-muted">
                    {p.side}
                    {p.down != null ? ` · ${p.down}&${p.distance}` : ""} ·{" "}
                    {p.tags.find((t) => t.category === "concept")?.label ?? "untagged"}
                  </p>
                </div>
                {p.yardsGained != null && (
                  <span className="tabular text-fg-muted">{formatYards(p.yardsGained)}</span>
                )}
              </Link>
            );
          })}
          {plays.length === 0 && (
            <p className="p-6 text-sm text-fg-muted">No plays in this cutup.</p>
          )}
        </div>
      </div>
    </div>
  );
}
