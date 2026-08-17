import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FilmCard } from "@/components/film/film-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGameDate, nextGame } from "@/lib/core/schedule";
import { groupFilmsForLibrary, playableScheduleGames } from "@/lib/core/seed";
import type { FilmStatus, Venue } from "@/lib/core/types";
import type { UploadMode } from "@/lib/core/upload";
import { YOUTH_TEAM_LABEL } from "@/lib/core/youth-tags";
import { runLocalVisionToOfp } from "@/lib/media/vision-client";
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

function wantsUploadOpen(href: string): boolean {
  try {
    const q = new URL(href, "http://local").searchParams;
    const v = q.get("upload");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      done(Number.isFinite(d) && d > 0 ? d : undefined);
    };
    video.onerror = () => done(undefined);
    video.src = url;
  });
}

function LibraryPage() {
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const libraryQuery = usePlayiqStore((s) => s.libraryQuery);
  const libraryStatus = usePlayiqStore((s) => s.libraryStatus);
  const setLibraryQuery = usePlayiqStore((s) => s.setLibraryQuery);
  const setLibraryStatus = usePlayiqStore((s) => s.setLibraryStatus);
  const uploadFilm = usePlayiqStore((s) => s.uploadFilm);
  const setFilmPlays = usePlayiqStore((s) => s.setFilmPlays);
  const createTeachThisWeekCutup = usePlayiqStore((s) => s.createTeachThisWeekCutup);
  const filmsRaw = usePlayiqStore((s) => s.films);
  const films = useMemo(
    () => libraryFilmList(filmsRaw, libraryQuery, libraryStatus),
    [filmsRaw, libraryQuery, libraryStatus],
  );
  const groups = useMemo(() => groupFilmsForLibrary(films), [films]);
  const upcoming = useMemo(() => nextGame(), []);
  const scheduleOptions = useMemo(() => playableScheduleGames(), []);

  const defaultWeek = useMemo(() => {
    if (!upcoming) return "1";
    const idx = scheduleOptions.findIndex((g) => g.id === upcoming.id);
    return String(idx >= 0 ? idx + 1 : 1);
  }, [upcoming, scheduleOptions]);

  const [uploadOpen, setUploadOpen] = useState(() => wantsUploadOpen(href));
  const [uploadMode, setUploadMode] = useState<UploadMode>("game");
  const [opponent, setOpponent] = useState(() => upcoming?.opponent ?? "");
  const [week, setWeek] = useState(defaultWeek);
  const [venue, setVenue] = useState<Venue>(
    () =>
      upcoming?.kind === "away"
        ? "away"
        : upcoming?.kind === "neutral" || upcoming?.kind === "playoff"
          ? "neutral"
          : "home",
  );
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileBlob, setFileBlob] = useState<Blob | undefined>();
  const [durationSec, setDurationSec] = useState<number | undefined>();
  const [splitting, setSplitting] = useState(false);
  const [splitProgress, setSplitProgress] = useState("");

  useEffect(() => {
    if (wantsUploadOpen(href)) setUploadOpen(true);
  }, [href]);

  function applyScheduleGame(opponentName: string) {
    const game = scheduleOptions.find((g) => g.opponent === opponentName);
    if (!game) return;
    const idx = scheduleOptions.findIndex((g) => g.id === game.id);
    setWeek(String(idx + 1));
    setVenue(
      game.kind === "away"
        ? "away"
        : game.kind === "neutral" || game.kind === "playoff"
          ? "neutral"
          : "home",
    );
  }

  async function submitUpload() {
    const w = Number(week);
    if (!opponent.trim()) {
      toast.message("Opponent required");
      return;
    }
    if (uploadMode === "game" && !fileBlob) {
      toast.message("Full game needs a video file");
      return;
    }

    const id = uploadFilm({
      opponent: opponent.trim(),
      week: Number.isFinite(w) ? w : 1,
      venue,
      fileName,
      file: fileBlob,
      durationSec,
      mode: uploadMode,
    });

    if (uploadMode === "game" && fileBlob) {
      setSplitting(true);
      setSplitProgress("Starting…");
      try {
        const result = await runLocalVisionToOfp(
          fileBlob,
          {
            opponent: opponent.trim(),
            week: Number.isFinite(w) ? w : 1,
            fileName,
            filmId: id,
            venue,
            level: "youth",
            honest: true,
          },
          (msg) => setSplitProgress(msg),
        );
        setFilmPlays(id, result.plays, "needs_review");
        usePlayiqStore.setState((state) => ({
          films: state.films.map((f) =>
            f.id === id
              ? {
                  ...f,
                  durationSec: result.durationSec,
                  status: "needs_review" as const,
                  aiProgress: 100,
                  playCount: result.plays.length,
                }
              : f,
          ),
        }));
        toast.success("Game split complete", {
          description: `${result.playCount} plays · ${result.mode} frames. Review cuts — no invented downs/yards.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Split failed";
        toast.message("Could not auto-split", {
          description: `${msg}. Film saved — try again or upload play clips.`,
        });
      } finally {
        setSplitting(false);
        setSplitProgress("");
      }
    } else {
      toast.success("Clip added", {
        description: fileBlob
          ? "One play = this clip. Tag honestly in the film room."
          : "Shell created. Attach media in the film room for playback.",
      });
    }

    setUploadOpen(false);
    setFileName(undefined);
    setFileBlob(undefined);
    setDurationSec(undefined);
    void navigate({ to: "/app/film/$filmId", params: { filmId: id } });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            {YOUTH_TEAM_LABEL}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Film</h1>
          <p className="mt-2 max-w-lg text-sm text-fg-muted">
            Upload a full game to auto-split plays on this device, or drop one phone clip per
            play. Tag Inside run vs Outside run — confirm yards later.
          </p>
          {upcoming && (
            <p className="mt-2 text-sm text-fg">
              Next up: vs {upcoming.opponent} · {formatGameDate(upcoming.date)}
              {upcoming.time ? ` · ${upcoming.time}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const id = createTeachThisWeekCutup();
              if (!id) {
                toast.message("Star plays first", {
                  description: "Star teach plays, then build this week’s reel.",
                });
                return;
              }
              toast.success("Teach reel ready");
              void navigate({ to: "/app/cutups" });
            }}
          >
            Teach this week
          </Button>
          <Button type="button" variant="primary" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload film
          </Button>
        </div>
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
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="mb-3 text-sm font-semibold text-fg">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.films.map((f) => (
                  <FilmCard key={f.id} film={f} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
          onClick={() => !splitting && setUploadOpen(false)}
        >
          <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="upload-title" className="font-display text-2xl font-semibold">
                  Upload film
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Video stays on this device. Full game uses local scene-cut split — review
                  every play; nothing invents downs or yards.
                </p>
              </div>
              <button
                type="button"
                className="rounded-[var(--radius-sm)] p-2 text-fg-subtle hover:bg-bg-subtle"
                aria-label="Close"
                disabled={splitting}
                onClick={() => setUploadOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex gap-1.5">
                {(
                  [
                    { id: "game" as const, label: "Full game" },
                    { id: "clip" as const, label: "One play clip" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={splitting}
                    onClick={() => setUploadMode(m.id)}
                    className={
                      uploadMode === m.id
                        ? "h-9 flex-1 rounded-full bg-fg px-3 text-xs font-medium text-bg"
                        : "h-9 flex-1 rounded-full border border-border px-3 text-xs font-medium text-fg-muted"
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <label className="block text-xs text-fg-subtle">
                {uploadMode === "game" ? "Game video" : "Phone clip"}
                <input
                  type="file"
                  accept="video/*"
                  disabled={splitting}
                  className="mt-1 block w-full text-sm text-fg-muted file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-bg-subtle file:px-3 file:py-2 file:text-sm file:text-fg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFileName(f?.name);
                    setFileBlob(f ?? undefined);
                    setDurationSec(undefined);
                    if (f) {
                      void readVideoDuration(f).then((d) => {
                        if (d) setDurationSec(d);
                      });
                    }
                  }}
                />
                {fileName ? (
                  <span className="mt-1 block text-[11px] text-success">
                    {fileName} ready
                    {durationSec
                      ? ` · ${durationSec >= 60 ? `${(durationSec / 60).toFixed(1)} min` : `${durationSec.toFixed(1)}s`}`
                      : ""}
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-fg-subtle">
                    {uploadMode === "game"
                      ? "MP4 / MOV — stays local while plays are cut."
                      : "MP4 / MOV — one play per file."}
                  </span>
                )}
              </label>
              <label className="block text-xs text-fg-subtle">
                Opponent
                <select
                  disabled={splitting}
                  className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm text-fg focus-ring"
                  value={
                    scheduleOptions.some((g) => g.opponent === opponent) ? opponent : "__custom"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom") {
                      setOpponent("");
                      return;
                    }
                    setOpponent(v);
                    applyScheduleGame(v);
                  }}
                >
                  {scheduleOptions.map((g) => (
                    <option key={g.id} value={g.opponent}>
                      {g.opponent} · {formatGameDate(g.date)}
                    </option>
                  ))}
                  <option value="__custom">Other / practice…</option>
                </select>
                {!scheduleOptions.some((g) => g.opponent === opponent) && (
                  <Input
                    className="mt-2"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="Opponent"
                    autoFocus
                    disabled={splitting}
                  />
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-fg-subtle">
                  Week
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={20}
                    value={week}
                    disabled={splitting}
                    onChange={(e) => setWeek(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-fg-subtle">
                  Venue
                  <select
                    value={venue}
                    disabled={splitting}
                    onChange={(e) => setVenue(e.target.value as Venue)}
                    className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm text-fg focus-ring"
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </label>
              </div>
              {splitting && (
                <p className="text-xs text-fg-muted" aria-live="polite">
                  {splitProgress || "Splitting plays on this device…"}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={splitting}
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={splitting}
                onClick={() => void submitUpload()}
              >
                {splitting
                  ? "Splitting…"
                  : uploadMode === "game"
                    ? "Upload & split"
                    : "Add clip"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
