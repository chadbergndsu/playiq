import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FilmCard } from "@/components/film/film-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilmStatus, Venue } from "@/lib/core/types";
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
  const navigate = useNavigate();
  const libraryQuery = usePlayiqStore((s) => s.libraryQuery);
  const libraryStatus = usePlayiqStore((s) => s.libraryStatus);
  const setLibraryQuery = usePlayiqStore((s) => s.setLibraryQuery);
  const setLibraryStatus = usePlayiqStore((s) => s.setLibraryStatus);
  const uploadFilm = usePlayiqStore((s) => s.uploadFilm);
  const filmsRaw = usePlayiqStore((s) => s.films);
  const films = useMemo(
    () => libraryFilmList(filmsRaw, libraryQuery, libraryStatus),
    [filmsRaw, libraryQuery, libraryStatus],
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [week, setWeek] = useState("1");
  const [venue, setVenue] = useState<Venue>("home");
  const [fileName, setFileName] = useState<string | undefined>();

  function submitUpload() {
    const w = Number(week);
    if (!opponent.trim()) {
      toast.message("Opponent required");
      return;
    }
    const id = uploadFilm({
      opponent: opponent.trim(),
      week: Number.isFinite(w) ? w : 1,
      venue,
      fileName,
    });
    setUploadOpen(false);
    setOpponent("");
    setFileName(undefined);
    toast.success("Film queued", {
      description: "Encode + AI first-pass running. Opens when ready for review.",
    });
    void navigate({ to: "/app/film/$filmId", params: { filmId: id } });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Library</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Film</h1>
          <p className="mt-2 max-w-lg text-sm text-fg-muted">
            Season film with first-pass AI tags. Upload game film or open demo games to
            review, correct, and cut.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)}>
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

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
          onClick={() => setUploadOpen(false)}
        >
          <div
            className="panel w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="upload-title" className="font-display text-2xl font-semibold">
                  Upload film
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Creates a film record and runs a local AI first-pass. Object storage
                  encode pipeline is next for production files.
                </p>
              </div>
              <button
                type="button"
                className="rounded-[var(--radius-sm)] p-2 text-fg-subtle hover:bg-bg-subtle"
                aria-label="Close"
                onClick={() => setUploadOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs text-fg-subtle">
                Opponent
                <Input
                  className="mt-1"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Westfield"
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-fg-subtle">
                  Week
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={20}
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-fg-subtle">
                  Venue
                  <select
                    value={venue}
                    onChange={(e) => setVenue(e.target.value as Venue)}
                    className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm text-fg focus-ring"
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs text-fg-subtle">
                Video file (optional)
                <input
                  type="file"
                  accept="video/*"
                  className="mt-1 block w-full text-sm text-fg-muted file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-bg-subtle file:px-3 file:py-2 file:text-sm file:text-fg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFileName(f?.name);
                    if (f && !opponent.trim()) {
                      setOpponent(f.name.replace(/\.[^.]+$/, "").slice(0, 40));
                    }
                  }}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitUpload}>
                Start analysis
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
