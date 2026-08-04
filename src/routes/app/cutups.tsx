import { Link, createFileRoute } from "@tanstack/react-router";
import { Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cutupDurationSec } from "@/lib/core/cutups";
import { usePlayiqStore } from "@/lib/store/playiq-store";
import { formatClock, plural } from "@/lib/utils";

export const Route = createFileRoute("/app/cutups")({
  component: CutupsPage,
});

function CutupsPage() {
  const cutups = usePlayiqStore((s) => s.cutups);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const deleteCutup = usePlayiqStore((s) => s.deleteCutup);
  const allPlays = Object.values(playsByFilm).flat();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Teach</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Cutups</h1>
        <p className="mt-2 max-w-lg text-sm text-fg-muted">
          Filtered playlists for install meetings. Build from any film review filter.
        </p>
      </div>

      {cutups.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Scissors className="h-8 w-8 text-fg-subtle" />
          <p className="text-sm text-fg-muted">No cutups yet. Save one from a film review.</p>
          <Link to="/app/library">
            <Button variant="secondary">Browse film</Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cutups.map((c) => {
            const dur = cutupDurationSec(allPlays, c.playIds);
            return (
              <li key={c.id} className="panel flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{c.title}</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      {c.description || c.filterSummary}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] p-2 text-fg-subtle hover:bg-bg-subtle hover:text-fg focus-ring"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => {
                      deleteCutup(c.id);
                      toast.message("Cutup removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-fg-subtle">
                  <span>{plural(c.playIds.length, "play")}</span>
                  <span>{formatClock(dur)} runtime</span>
                  <span>{c.filterSummary}</span>
                </div>
                <div className="mt-5">
                  <Link to="/app/cutups/$cutupId" params={{ cutupId: c.id }}>
                    <Button variant="secondary" size="sm">
                      Open cutup
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
