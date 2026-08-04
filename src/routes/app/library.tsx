import { createFileRoute } from "@tanstack/react-router";
import { Search, Upload } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { FilmCard } from "@/components/film/film-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilmStatus } from "@/lib/core/types";
import { libraryFilmList, usePlayiqStore } from "@/lib/store/playiq-store";

export const Route = createFileRoute("/app/library")({
  component: LibraryPage,
});

const statuses: Array<{ id: FilmStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs_review", label: "Needs review" },
  { id: "processing", label: "Analyzing" },
];

function LibraryPage() {
  const libraryQuery = usePlayiqStore((s) => s.libraryQuery);
  const libraryStatus = usePlayiqStore((s) => s.libraryStatus);
  const setLibraryQuery = usePlayiqStore((s) => s.setLibraryQuery);
  const setLibraryStatus = usePlayiqStore((s) => s.setLibraryStatus);
  const filmsRaw = usePlayiqStore((s) => s.films);
  const films = useMemo(
    () => libraryFilmList(filmsRaw, libraryQuery, libraryStatus),
    [filmsRaw, libraryQuery, libraryStatus],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Library</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Film</h1>
          <p className="mt-2 max-w-lg text-sm text-fg-muted">
            Season film with first-pass AI tags. Open a game to review, correct, and cut.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            toast.message("Upload stub", {
              description:
                "Connect object storage + encode pipeline next. Demo uses seeded season film.",
            })
          }
        >
          <Upload className="h-4 w-4" />
          Upload film
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Search opponent, week…"
            className="pl-9"
            aria-label="Search film"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setLibraryStatus(s.id)}
              className={
                libraryStatus === s.id
                  ? "h-9 rounded-full bg-fg px-3 text-xs font-medium text-bg"
                  : "h-9 rounded-full border border-border px-3 text-xs font-medium text-fg-muted hover:text-fg"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {films.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-fg-muted">No film matches this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {films.map((f) => (
            <FilmCard key={f.id} film={f} />
          ))}
        </div>
      )}
    </div>
  );
}
