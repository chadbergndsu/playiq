import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Keyboard,
  LoaderCircle,
  Paperclip,
  ScanSearch,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayDetail } from "@/components/film/play-detail";
import { PlayList } from "@/components/film/play-list";
import { FilmStatusBadge } from "@/components/film/status-badge";
import { FilmTimeline } from "@/components/film/timeline";
import { VideoStage, type PlaybackSpeed } from "@/components/film/video-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Down, PlayFilter, PlayTag, Side, TagSource } from "@/lib/core/types";
import { filterPlays, listConceptLabels } from "@/lib/core/cutups";
import { mergeTrackingArtifacts, type TrackingArtifact } from "@/lib/core/tracking";
import { playsToWebVttChapters } from "@/lib/core/webvtt";
import { trimSegmentToMp4 } from "@/lib/media/cut-assembly";
import { getFilmMedia, registerFilmMedia } from "@/lib/media/media-registry";
import { JERSEY_KEY } from "@/lib/core/training-clip";
import { formatJersey, TEAM_ROSTER } from "@/lib/core/roster";
import { analyzeFilmTracking, checkTrackerHealth } from "@/lib/media/tracker-client";
import { loadTrackingArtifact, saveTrackingArtifact } from "@/lib/media/tracking-registry";
import { filmById, playsForFilm, usePlayiqStore } from "@/lib/store/playiq-store";

export const Route = createFileRoute("/app/film/$filmId")({
  component: FilmReviewPage,
});

type TagApiResponse = {
  filmId: string;
  mode: "ok" | "llm" | "heuristic";
  xaiConfigured: boolean;
  playTags: Record<string, PlayTag[]>;
  warning?: string;
  error?: string;
};

async function requestFilmTags(
  filmId: string,
  plays: ReturnType<typeof playsForFilm>,
): Promise<TagApiResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const { getBearerToken } = await import("@/lib/auth/client");
    const bearer = getBearerToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  } catch {
    /* client auth optional */
  }
  const res = await fetch("/api/film/tag", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      filmId,
      plays: plays.map((p) => ({
        id: p.id,
        side: p.side,
        down: p.down,
        distance: p.distance,
        yardLine: p.yardLine,
        yardsGained: p.yardsGained,
        result: p.result,
        notes: p.notes,
      })),
    }),
  });
  const data = (await res.json()) as TagApiResponse;
  if (!res.ok) {
    throw new Error(data.error || `Tagging failed (${res.status})`);
  }
  return data;
}

function FilmReviewPage() {
  const { filmId } = Route.useParams();
  const films = usePlayiqStore((s) => s.films);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const selectedPlayId = usePlayiqStore((s) => s.selectedPlayId);
  const selectPlay = usePlayiqStore((s) => s.selectPlay);
  const addCoachTag = usePlayiqStore((s) => s.addCoachTag);
  const removeTag = usePlayiqStore((s) => s.removeTag);
  const setPlayNote = usePlayiqStore((s) => s.setPlayNote);
  const toggleStarPlay = usePlayiqStore((s) => s.toggleStarPlay);
  const reanalyzeFilm = usePlayiqStore((s) => s.reanalyzeFilm);
  const applyAiTagsForFilm = usePlayiqStore((s) => s.applyAiTagsForFilm);
  const createCutupFromFilter = usePlayiqStore((s) => s.createCutupFromFilter);
  const hydrated = usePlayiqStore((s) => s.hydrated);
  const [tagging, setTagging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [trackingArtifact, setTrackingArtifact] = useState<TrackingArtifact | null>(null);
  const trackingAbortRef = useRef<AbortController | null>(null);
  const activeFilmIdRef = useRef(filmId);
  /** Bump to re-read media registry after attach */
  const [mediaEpoch, setMediaEpoch] = useState(0);

  const film = useMemo(() => filmById(films, filmId), [films, filmId]);
  const plays = useMemo(() => playsForFilm(playsByFilm, filmId), [playsByFilm, filmId]);
  const media = useMemo(() => {
    void mediaEpoch;
    void hydrated;
    return getFilmMedia(filmId);
  }, [filmId, mediaEpoch, hydrated]);

  const [vttUrl, setVttUrl] = useState<string | null>(null);

  useEffect(() => {
    activeFilmIdRef.current = filmId;
    setTrackingArtifact(null);
    let cancelled = false;
    void loadTrackingArtifact(filmId).then((artifact) => {
      if (!cancelled) setTrackingArtifact(artifact);
    });
    return () => {
      cancelled = true;
      trackingAbortRef.current?.abort();
    };
  }, [filmId]);

  useEffect(() => {
    if (plays.length === 0) {
      setVttUrl(null);
      return;
    }
    const vtt = playsToWebVttChapters(plays, { title: film?.title });
    const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
    setVttUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [plays, film?.title]);

  const hasRealMedia = Boolean(media || film?.sourceUrl);

  const [side, setSide] = useState<Side | "all">("all");
  const [down, setDown] = useState<Down | "all">("all");
  const [concept, setConcept] = useState<string | "all">("all");
  const [source, setSource] = useState<TagSource | "all">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [currentSec, setCurrentSec] = useState(0);
  /** When on, end of a play jumps to the next filtered play (teach mode). */
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [playbackEpoch, setPlaybackEpoch] = useState(0);
  const timeRafRef = useRef<number | null>(null);

  const concepts = useMemo(() => listConceptLabels(plays), [plays]);

  const filter: PlayFilter = useMemo(
    () => ({
      query,
      side,
      concept,
      down,
      source,
      starredOnly,
    }),
    [query, side, concept, down, source, starredOnly],
  );

  const visible = useMemo(() => filterPlays(plays, filter), [plays, filter]);

  const selected = plays.find((p) => p.id === selectedPlayId) ?? visible[0] ?? plays[0] ?? null;

  const confirmedJerseys = useMemo(() => {
    if (!selected) return [];
    return TEAM_ROSTER.filter((player) => {
      const label = formatJersey(player.number);
      return label != null && selected.tags.some((tag) => tag.label === label);
    }).map((player) => player.number);
  }, [selected]);

  useEffect(() => {
    if (!selectedPlayId && plays[0]) selectPlay(plays[0].id);
  }, [plays, selectedPlayId, selectPlay]);

  const selectedId = selected?.id ?? null;
  const selectedStart = selected?.startSec ?? 0;

  useEffect(() => {
    if (selectedId == null) return;
    setCurrentSec(selectedStart);
  }, [selectedId, selectedStart]);

  const stepPlay = useCallback(
    (dir: -1 | 1, opts?: { keepPlaying?: boolean }) => {
      if (!selected) return false;
      const list = visible.length ? visible : plays;
      const idx = list.findIndex((p) => p.id === selected.id);
      const next = list[idx + dir];
      if (next) {
        selectPlay(next.id);
        setCurrentSec(next.startSec);
        setPlaybackEpoch((e) => e + 1);
        if (opts?.keepPlaying) setPlaying(true);
        return true;
      }
      if (opts?.keepPlaying) setPlaying(false);
      return false;
    },
    [plays, visible, selected, selectPlay],
  );

  const onPlayEnded = useCallback(() => {
    if (autoAdvance) {
      stepPlay(1, { keepPlaying: true });
    } else {
      setPlaying(false);
    }
  }, [autoAdvance, stepPlay]);

  const runTracking = useCallback(async () => {
    if (!film || !selected || tracking) return;
    const requestedFilmId = film.id;
    let videoBlob = media?.blob;
    let fileName = media?.fileName ?? film.sourceFileName ?? "film.mp4";
    if (!videoBlob && film.sourceUrl) {
      try {
        const response = await fetch(film.sourceUrl);
        if (!response.ok) throw new Error(`Media fetch failed (${response.status})`);
        videoBlob = await response.blob();
        fileName = film.sourceFileName ?? film.sourceUrl.split("/").pop() ?? "film.mp4";
      } catch (error) {
        toast.error("Could not load film for tracking", {
          description: error instanceof Error ? error.message : "Media unavailable",
        });
        return;
      }
    }
    if (!videoBlob) {
      toast.message("Attach media first", {
        description: "The local tracker needs the original video file.",
      });
      return;
    }

    const controller = new AbortController();
    trackingAbortRef.current = controller;
    setTracking(true);
    try {
      const playDuration = selected.endSec - selected.startSec;
      const windowDuration = Math.min(90, playDuration);
      const windowStart =
        playDuration > 90
          ? Math.min(
              Math.max(selected.startSec, currentSec - windowDuration / 2),
              selected.endSec - windowDuration,
            )
          : selected.startSec;
      const windowEnd = Math.min(selected.endSec, windowStart + windowDuration);

      const health = await checkTrackerHealth(controller.signal);
      if (controller.signal.aborted || activeFilmIdRef.current !== requestedFilmId) return;
      toast.message("Preparing local tracking", {
        description: `${health.model} on ${health.device}. Trimming Play ${selected.index} before local analysis.`,
      });

      let trackerVideo: Blob;
      let trackerStartSec = 0;
      let trackerEndSec = windowEnd - windowStart;
      let timeOffsetSec = windowStart;
      try {
        trackerVideo = await trimSegmentToMp4(
          videoBlob,
          {
            startSec: windowStart,
            endSec: windowEnd,
          },
          undefined,
          controller.signal,
        );
      } catch (trimError) {
        // Small clips are safe to send whole; never recopy a multi-GB game per play.
        if (videoBlob.size > 200 * 1024 * 1024) {
          throw new Error(
            `The browser could not trim this game before tracking: ${
              trimError instanceof Error ? trimError.message : "codec unavailable"
            }`,
          );
        }
        trackerVideo = videoBlob;
        trackerStartSec = windowStart;
        trackerEndSec = windowEnd;
        timeOffsetSec = 0;
      }
      if (controller.signal.aborted || activeFilmIdRef.current !== requestedFilmId) return;

      const windowArtifact = await analyzeFilmTracking({
        filmId: film.id,
        fileName: `${fileName.replace(/\.[^.]+$/, "")}-play-${selected.index}.mp4`,
        video: trackerVideo,
        rosterNumbers: TEAM_ROSTER.map((player) => player.number),
        analyzedFps: 5,
        startSec: trackerStartSec,
        endSec: trackerEndSec,
        signal: controller.signal,
      });
      if (controller.signal.aborted || activeFilmIdRef.current !== requestedFilmId) return;
      const artifact: TrackingArtifact = {
        ...windowArtifact,
        sourceFileName: fileName,
        durationSec: film.durationSec,
        frames: windowArtifact.frames.map((frame) => ({
          ...frame,
          t: frame.t + timeOffsetSec,
        })),
      };
      const existing = await loadTrackingArtifact(requestedFilmId);
      const merged = mergeTrackingArtifacts(existing, artifact, {
        startSec: windowStart,
        endSec: windowEnd,
      });
      await saveTrackingArtifact(merged);
      if (controller.signal.aborted || activeFilmIdRef.current !== requestedFilmId) return;
      setTrackingArtifact(merged);
      setTrackingEnabled(true);
      toast.success("Tracking ready", {
        description: `Play ${selected.index}: ${artifact.frames.length} analyzed frames${playDuration > 90 ? " (90-second window)" : ""}. Jersey labels with ? require coach confirmation.`,
      });
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }
      toast.error("Tracking failed", {
        description: error instanceof Error ? error.message : "Local tracker failed",
      });
    } finally {
      trackingAbortRef.current = null;
      setTracking(false);
    }
  }, [currentSec, film, media, selected, tracking]);

  const confirmTrackedJersey = useCallback(
    (number: number, confidence: number) => {
      if (!selected) return;
      const label = formatJersey(number);
      if (!label) return;
      addCoachTag(selected.id, label, "personnel");
      toast.success(`${label} confirmed`, {
        description: `Saved as a coach tag on Play ${selected.index}; OCR confidence was ${Math.round(confidence * 100)}%.`,
      });
    },
    [addCoachTag, selected],
  );

  // Demo stage clock (no real media)
  useEffect(() => {
    if (hasRealMedia || !playing || !selected) return;
    const tickMs = Math.max(50, Math.round(250 / speed));
    const step = 0.25 * speed;
    let ended = false;
    const id = window.setInterval(() => {
      if (ended) return;
      setCurrentSec((t) => {
        const next = t + step;
        if (next >= selected.endSec) {
          ended = true;
          window.clearInterval(id);
          window.setTimeout(() => onPlayEnded(), 0);
          return selected.endSec;
        }
        return next;
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [playing, selected, speed, hasRealMedia, onPlayEnded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "j" || e.key === "J") {
        stepPlay(1);
      } else if (e.key === "k" || e.key === "K") {
        stepPlay(-1);
      } else if (e.key === "s" || e.key === "S") {
        if (selected) {
          toggleStarPlay(selected.id);
          toast.message(selected.starred ? "Unstarred" : "Starred for install");
        }
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      } else if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        setDown(Number(e.key) as Down);
      } else if (e.key === "0") {
        setDown("all");
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepPlay, selected, toggleStarPlay]);

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
              {film.week > 0 ? `Week ${film.week} · ` : `${film.opponent} · `}
              {film.date} · {film.venue} · {plays.length} plays
              {film.sourceFileName ? ` · ${film.sourceFileName}` : ""}
              {hasRealMedia ? " · media ready" : ""}
            </p>
            {film.level === "youth" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs font-medium text-fg">
                  {JERSEY_KEY.summary}
                </p>
                <Link
                  to="/app/roster"
                  className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg"
                >
                  Roster · {TEAM_ROSTER.length}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-transparent px-3 text-sm font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2">
            <Paperclip className="h-4 w-4" />
            {media ? "Replace media" : "Attach media"}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                registerFilmMedia(film.id, f, f.name);
                setMediaEpoch((n) => n + 1);
                toast.success("Local media attached", {
                  description: `${f.name} — plays in the stage; cut assembly available.`,
                });
                e.target.value = "";
              }}
            />
          </label>
          {tracking ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => trackingAbortRef.current?.abort()}
            >
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Cancel tracking
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasRealMedia || !selected}
              onClick={() => void runTracking()}
            >
              <ScanSearch className="h-4 w-4" />
              {trackingArtifact ? "Track this play again" : "Track this play"}
            </Button>
          )}
          {trackingArtifact ? (
            <Button
              type="button"
              variant={trackingEnabled ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTrackingEnabled((enabled) => !enabled)}
              aria-pressed={trackingEnabled}
            >
              {trackingEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Boxes {trackingEnabled ? "on" : "off"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={autoAdvance ? "primary" : "ghost"}
            size="sm"
            onClick={() => setAutoAdvance((v) => !v)}
            aria-pressed={autoAdvance}
            aria-label="Toggle auto-advance to next play"
          >
            Auto-advance {autoAdvance ? "on" : "off"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen(true)}
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
            Keys
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={tagging || plays.length === 0}
            onClick={() => {
              void (async () => {
                setTagging(true);
                try {
                  const data = await requestFilmTags(film.id, plays);
                  applyAiTagsForFilm(film.id, data.playTags);
                  toast.success("AI re-analysis complete", {
                    description: data.warning
                      ? `${data.warning} Coach tags preserved.`
                      : "Tags applied. Coach tags preserved.",
                  });
                } catch (err) {
                  reanalyzeFilm(film.id);
                  const msg = err instanceof Error ? err.message : "Request failed";
                  toast.message("Used offline heuristics", {
                    description: `${msg}. Coach tags preserved.`,
                  });
                } finally {
                  setTagging(false);
                }
              })();
            }}
          >
            <Sparkles className="h-4 w-4" />
            {tagging ? "Running AI…" : "Re-run AI tags"}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              createCutupFromFilter(`${film.opponent} — filtered cut`, film.id, filter);
              toast.success("Cutup created", { description: "Open Cutups to share or export." });
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
        durationSec={hasRealMedia ? Math.max(film.durationSec, currentSec + 1) : film.durationSec}
        playing={playing}
        speed={speed}
        mediaUrl={media?.objectUrl ?? film.sourceUrl}
        vttUrl={vttUrl}
        playStartSec={selected?.startSec}
        playEndSec={selected?.endSec}
        orientation={film.orientation}
        trackingArtifact={trackingArtifact}
        trackingEnabled={trackingEnabled}
        confirmedJerseys={confirmedJerseys}
        onConfirmJersey={confirmTrackedJersey}
        onSpeedChange={setSpeed}
        playLabel={
          selected
            ? `Play ${selected.index} · ${selected.side}${selected.down != null ? ` · ${selected.down}&${selected.distance}` : ""}`
            : "No play selected"
        }
        onToggle={() => setPlaying((p) => !p)}
        onPrev={() => stepPlay(-1)}
        onNext={() => stepPlay(1)}
        playbackEpoch={playbackEpoch}
        onTimeUpdate={(t) => {
          if (!hasRealMedia) return;
          if (timeRafRef.current != null) return;
          timeRafRef.current = requestAnimationFrame(() => {
            timeRafRef.current = null;
            setCurrentSec(t);
          });
        }}
        onEndedPlay={onPlayEnded}
      />

      {trackingArtifact?.warnings.length ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-4 py-3">
          <p className="text-xs font-medium text-fg">Tracking notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-fg-muted">
            {trackingArtifact.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-subtle">
            Click a cyan <strong>#?</strong> box to save that roster match as a coach tag on the
            selected play.
          </p>
        </div>
      ) : null}

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
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
            <button
              type="button"
              onClick={() => setStarredOnly((v) => !v)}
              className={
                starredOnly
                  ? "h-8 rounded-full bg-fg px-3 text-xs font-medium text-bg"
                  : "h-8 rounded-full border border-border px-3 text-xs font-medium text-fg-muted"
              }
            >
              Starred
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-fg-subtle">
              Down
              <select
                value={down === "all" ? "all" : String(down)}
                onChange={(e) => {
                  const v = e.target.value;
                  setDown(v === "all" ? "all" : (Number(v) as Down));
                }}
                className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus-ring"
              >
                <option value="all">All</option>
                <option value="1">1st</option>
                <option value="2">2nd</option>
                <option value="3">3rd</option>
                <option value="4">4th</option>
              </select>
            </label>
            <label className="text-xs text-fg-subtle">
              Tag source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as TagSource | "all")}
                className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus-ring"
              >
                <option value="all">All</option>
                <option value="ai">AI</option>
                <option value="coach">Coach</option>
                <option value="import">Import</option>
              </select>
            </label>
          </div>

          <label className="block text-xs text-fg-subtle">
            Concept
            <select
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm text-fg focus-ring"
            >
              <option value="all">All concepts</option>
              {concepts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter plays / tags…"
            aria-label="Filter plays"
          />
          <p className="text-xs text-fg-subtle">
            Showing {visible.length} of {plays.length}
          </p>
          <div className="max-h-[28rem] overflow-y-auto rounded-[var(--radius-lg)]">
            <PlayList
              plays={visible}
              selectedId={selected?.id ?? null}
              onSelect={(id) => {
                selectPlay(id);
                setPlaybackEpoch((e) => e + 1);
                setPlaying(false);
              }}
            />
          </div>
        </div>

        {selected ? (
          <PlayDetail
            play={selected}
            youthMode={film.level === "youth"}
            onAddTag={(label, category) => {
              addCoachTag(selected.id, label, category);
              toast.message("Coach tag added");
            }}
            onRemoveTag={(tagId) => removeTag(selected.id, tagId)}
            onNote={(notes) => setPlayNote(selected.id, notes)}
            onToggleStar={() => {
              toggleStarPlay(selected.id);
              toast.message(selected.starred ? "Unstarred" : "Starred for install");
            }}
          />
        ) : (
          <div className="panel grid place-items-center p-10 text-sm text-fg-muted">
            Select a play to review tags.
          </div>
        )}
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="keys-title"
          onClick={() => setHelpOpen(false)}
        >
          <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="keys-title" className="font-display text-2xl font-semibold">
              Keyboard shortcuts
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-fg-muted">
              <li>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">Space</kbd> Play
                / pause
              </li>
              <li>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">J</kbd> /{" "}
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">K</kbd> Next /
                previous play (filtered list)
              </li>
              <li>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">S</kbd> Star /
                unstar play
              </li>
              <li>Auto-advance (toolbar) — on play end, jump to next filtered play</li>
              <li>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">1</kbd>–
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">4</kbd> Filter
                by down ·{" "}
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">0</kbd> all
                downs
              </li>
              <li>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-fg">?</kbd> Toggle
                this help
              </li>
            </ul>
            <Button
              type="button"
              variant="secondary"
              className="mt-5"
              onClick={() => setHelpOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
