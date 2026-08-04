import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Scissors, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlayDetail } from "@/components/film/play-detail";
import { PlayList } from "@/components/film/play-list";
import { FilmStatusBadge } from "@/components/film/status-badge";
import { FilmTimeline } from "@/components/film/timeline";
import { VideoStage } from "@/components/film/video-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayFilter, Side } from "@/lib/core/types";
import { filterPlays } from "@/lib/core/cutups";
import { filmById, playsForFilm, usePlayiqStore } from "@/lib/store/playiq-store";

export const Route = createFileRoute("/app/film/$filmId")({
  component: FilmReviewPage,
});

function FilmReviewPage() {
  const { filmId } = Route.useParams();
  const films = usePlayiqStore((s) => s.films);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const selectedPlayId = usePlayiqStore((s) => s.selectedPlayId);
  const selectPlay = usePlayiqStore((s) => s.selectPlay);
  const addCoachTag = usePlayiqStore((s) => s.addCoachTag);
  const removeTag = usePlayiqStore((s) => s.removeTag);
  const setPlayNote = usePlayiqStore((s) => s.setPlayNote);
  const reanalyzeFilm = usePlayiqStore((s) => s.reanalyzeFilm);
  const createCutupFromFilter = usePlayiqStore((s) => s.createCutupFromFilter);

  const film = useMemo(() => filmById(films, filmId), [films, filmId]);
  const plays = useMemo(() => playsForFilm(playsByFilm, filmId), [playsByFilm, filmId]);

  const [side, setSide] = useState<Side | "all">("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);

  const filter: PlayFilter = useMemo(
    () => ({
      query,
      side,
      concept: "all",
      down: "all",
      source: "all",
    }),
    [query, side],
  );

  const visible = useMemo(() => filterPlays(plays, filter), [plays, filter]);

  const selected =
    plays.find((p) => p.id === selectedPlayId) ?? visible[0] ?? plays[0] ?? null;

  useEffect(() => {
    if (!selectedPlayId && plays[0]) selectPlay(plays[0].id);
  }, [plays, selectedPlayId, selectPlay]);

  useEffect(() => {
    if (selected) setCurrentSec(selected.startSec);
  }, [selected]);

  useEffect(() => {
    if (!playing || !selected) return;
    const id = window.setInterval(() => {
      setCurrentSec((t) => {
        const next = t + 0.25;
        if (next >= selected.endSec) {
          setPlaying(false);
          return selected.endSec;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, selected]);

  const stepPlay = useCallback(
    (dir: -1 | 1) => {
      if (!selected) return;
      const idx = plays.findIndex((p) => p.id === selected.id);
      const next = plays[idx + dir];
      if (next) {
        selectPlay(next.id);
        setCurrentSec(next.startSec);
      }
    },
    [plays, selected, selectPlay],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "j" || e.key === "J") {
        stepPlay(1);
      } else if (e.key === "k" || e.key === "K") {
        stepPlay(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepPlay]);

  if (!film) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-fg-muted">Film not found.</p>
        <Link to="/app/library" className="mt-4 inline-block text-sm hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/app/library"
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg-muted hover:text-fg focus-ring"
            aria-label="Back to library"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {film.title}
              </h1>
              <FilmStatusBadge status={film.status} />
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              Week {film.week} · {film.date} · {film.venue} · {plays.length} plays
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reanalyzeFilm(film.id);
              toast.success("AI re-analysis complete", {
                description: "Coach tags preserved; AI tags refreshed.",
              });
            }}
          >
            <Sparkles className="h-4 w-4" />
            Re-run AI tags
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              createCutupFromFilter(`${film.opponent} — filtered cut`, film.id, filter);
              toast.success("Cutup created", { description: "Open Cutups to review." });
            }}
          >
            <Scissors className="h-4 w-4" />
            Save cutup
          </Button>
        </div>
      </div>

      <VideoStage
        title={film.title}
        opponent={film.opponent}
        hue={film.thumbnailHue}
        currentSec={currentSec}
        durationSec={film.durationSec}
        playing={playing}
        playLabel={
          selected
            ? `Play ${selected.index} · ${selected.side}${selected.down != null ? ` · ${selected.down}&${selected.distance}` : ""}`
            : "No play selected"
        }
        onToggle={() => setPlaying((p) => !p)}
        onPrev={() => stepPlay(-1)}
        onNext={() => stepPlay(1)}
      />

      <FilmTimeline
        plays={plays}
        durationSec={film.durationSec}
        currentSec={currentSec}
        selectedId={selected?.id ?? null}
        onSeek={(sec, playId) => {
          setCurrentSec(sec);
          if (playId) selectPlay(playId);
          setPlaying(false);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(["all", "offense", "defense", "special"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={
                  side === s
                    ? "h-8 rounded-full bg-fg px-3 text-xs font-medium capitalize text-bg"
                    : "h-8 rounded-full border border-border px-3 text-xs font-medium capitalize text-fg-muted"
                }
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter plays / tags…"
            aria-label="Filter plays"
          />
          <div className="max-h-[28rem] overflow-y-auto rounded-[var(--radius-lg)]">
            <PlayList
              plays={visible}
              selectedId={selected?.id ?? null}
              onSelect={(id) => {
                selectPlay(id);
                setPlaying(false);
              }}
            />
          </div>
        </div>

        {selected ? (
          <PlayDetail
            play={selected}
            onAddTag={(label) => {
              addCoachTag(selected.id, label);
              toast.message("Coach tag added");
            }}
            onRemoveTag={(tagId) => removeTag(selected.id, tagId)}
            onNote={(notes) => setPlayNote(selected.id, notes)}
          />
        ) : (
          <div className="panel grid place-items-center p-10 text-sm text-fg-muted">
            Select a play to review tags.
          </div>
        )}
      </div>
    </div>
  );
}
