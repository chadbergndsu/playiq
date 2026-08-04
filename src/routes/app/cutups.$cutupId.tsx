import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Link2,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayList } from "@/components/film/play-list";
import { VideoStage, type PlaybackSpeed } from "@/components/film/video-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  advanceTeachQueue,
  buildTeachQueue,
  clampQueueIndex,
  teachQueueDurationSec,
} from "@/lib/core/teach-queue";
import {
  buildCutupShareSnapshot,
  exportCutupCsv,
  exportCutupJson,
} from "@/lib/core/export";
import {
  assembleCutupFromSource,
  isWebCodecsAvailable,
} from "@/lib/media/cut-assembly";
import { getFilmMedia } from "@/lib/media/media-registry";
import { cutupPlays, usePlayiqStore } from "@/lib/store/playiq-store";
import { formatClock, formatYards, plural } from "@/lib/utils";

export const Route = createFileRoute("/app/cutups/$cutupId")({
  component: CutupDetailPage,
});

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CutupDetailPage() {
  const { cutupId } = Route.useParams();
  const cutups = usePlayiqStore((s) => s.cutups);
  const playsByFilm = usePlayiqStore((s) => s.playsByFilm);
  const films = usePlayiqStore((s) => s.films);
  const renameCutup = usePlayiqStore((s) => s.renameCutup);
  const removePlayFromCutup = usePlayiqStore((s) => s.removePlayFromCutup);
  const ensureCutupShareToken = usePlayiqStore((s) => s.ensureCutupShareToken);
  const setCutupShareToken = usePlayiqStore((s) => s.setCutupShareToken);
  const hydrated = usePlayiqStore((s) => s.hydrated);

  const cutup = useMemo(() => cutups.find((c) => c.id === cutupId), [cutups, cutupId]);
  const plays = useMemo(
    () => cutupPlays(playsByFilm, cutups, cutupId),
    [playsByFilm, cutups, cutupId],
  );
  const allPlays = useMemo(() => Object.values(playsByFilm).flat(), [playsByFilm]);

  const queue = useMemo(
    () =>
      buildTeachQueue({
        playIds: cutup?.playIds ?? [],
        plays: allPlays,
        films,
      }),
    [cutup?.playIds, allPlays, films],
  );

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [currentSec, setCurrentSec] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [loop, setLoop] = useState(false);
  const [mediaEpoch, setMediaEpoch] = useState(0);
  const [playbackEpoch, setPlaybackEpoch] = useState(0);
  const timeRafRef = useRef<number | null>(null);
  const clipPlayId = queue[clampQueueIndex(queueIndex, queue.length)]?.play.id ?? null;
  const clipStartSec =
    queue[clampQueueIndex(queueIndex, queue.length)]?.play.startSec ?? 0;

  const safeIndex = clampQueueIndex(queueIndex, queue.length);
  const clip = queue[safeIndex] ?? null;

  useEffect(() => {
    setQueueIndex(0);
    setPlaying(false);
    setPlaybackEpoch(0);
  }, [cutupId]);

  useEffect(() => {
    if (!clipPlayId) return;
    setCurrentSec(clipStartSec);
  }, [clipPlayId, clipStartSec]);

  const media = useMemo(() => {
    void mediaEpoch;
    void hydrated;
    if (!clip) return null;
    return getFilmMedia(clip.play.filmId);
  }, [clip, mediaEpoch, hydrated]);

  const goToClip = useCallback(
    (index: number, opts?: { play?: boolean }) => {
      const next = clampQueueIndex(index, queue.length);
      setQueueIndex(next);
      const c = queue[next];
      if (c) setCurrentSec(c.play.startSec);
      setPlaybackEpoch((e) => e + 1);
      if (opts?.play) setPlaying(true);
    },
    [queue],
  );

  const onClipEnded = useCallback(() => {
    const step = advanceTeachQueue({
      queueIndex: safeIndex,
      queueLength: queue.length,
      autoAdvance,
      loop,
    });
    if (step.kind === "end") {
      setPlaying(false);
      return;
    }
    goToClip(step.queueIndex, { play: true });
  }, [safeIndex, queue.length, autoAdvance, loop, goToClip]);

  // Demo clock when no media for current clip
  useEffect(() => {
    if (media || !playing || !clip) return;
    const tickMs = Math.max(50, Math.round(250 / speed));
    const step = 0.25 * speed;
    const end = clip.play.endSec;
    let ended = false;
    const id = window.setInterval(() => {
      if (ended) return;
      setCurrentSec((t) => {
        const next = t + step;
        if (next >= end) {
          ended = true;
          window.clearInterval(id);
          window.setTimeout(() => onClipEnded(), 0);
          return end;
        }
        return next;
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [playing, clip, speed, media, onClipEnded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "j" || e.key === "J") {
        goToClip(safeIndex + 1);
      } else if (e.key === "k" || e.key === "K") {
        goToClip(safeIndex - 1);
      } else if (e.key === "a" || e.key === "A") {
        setAutoAdvance((v) => !v);
      } else if (e.key === "l" || e.key === "L") {
        setLoop((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToClip, safeIndex]);

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

  const duration = teachQueueDurationSec(queue);
  const editingTitle = titleDraft ?? cutup.title;

  async function share() {
    const latest = usePlayiqStore.getState().cutups.find((c) => c.id === cutupId);
    if (!latest) return;
    const placeholder =
      latest.shareToken ?? ensureCutupShareToken(cutupId) ?? "pending";
    const snapshot = buildCutupShareSnapshot({
      token: placeholder,
      cutup: latest,
      plays: allPlays,
      films,
    });
    try {
      const res = await fetch("/api/share/cutup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
      };
      if (!res.ok) throw new Error(body.error || "Publish failed");
      if (!body.token) throw new Error("Server did not return a share token");
      setCutupShareToken(cutupId, body.token);
      const url = `${window.location.origin}/share/${body.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: url });
    } catch (err) {
      toast.message("Share failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function exportFmt(format: "csv" | "json") {
    const current = usePlayiqStore.getState().cutups.find((c) => c.id === cutupId);
    if (!current) return;
    const token = current.shareToken ?? ensureCutupShareToken(cutupId) ?? "export";
    const snapshot = buildCutupShareSnapshot({
      token,
      cutup: current,
      plays: allPlays,
      films,
    });
    const base = current.title.replace(/\s+/g, "_").slice(0, 40);
    if (format === "csv") {
      downloadText(`${base}.csv`, exportCutupCsv(snapshot), "text/csv");
    } else {
      downloadText(`${base}.json`, exportCutupJson(snapshot), "application/json");
    }
    toast.message(`Exported ${format.toUpperCase()}`);
  }

  async function assembleMedia() {
    const current = usePlayiqStore.getState().cutups.find((c) => c.id === cutupId);
    if (!current) return;
    if (!isWebCodecsAvailable()) {
      toast.message("WebCodecs not available in this browser");
      return;
    }
    const mediaByFilmId = new Map<
      string,
      { blob: Blob; fileName: string }
    >();
    for (const p of plays) {
      if (mediaByFilmId.has(p.filmId)) continue;
      const m = getFilmMedia(p.filmId);
      if (m) mediaByFilmId.set(p.filmId, { blob: m.blob, fileName: m.fileName });
    }
    if (mediaByFilmId.size === 0) {
      toast.message("No local media registered", {
        description: "Upload film with a video file or attach media on the film page.",
      });
      return;
    }
    setAssembling(true);
    try {
      const { assembleCutupMultiSource } = await import("@/lib/media/cut-assembly");
      const result =
        mediaByFilmId.size === 1
          ? await assembleCutupFromSource(
              mediaByFilmId.values().next().value!.blob,
              plays,
              {
                title: current.title,
                mediaPathHint: mediaByFilmId.values().next().value!.fileName,
                maxClips: 20,
              },
            )
          : await assembleCutupMultiSource(plays, mediaByFilmId, {
              title: current.title,
              maxClips: 20,
            });
      const base = current.title.replace(/\s+/g, "_").slice(0, 40);
      const revokeLater = (url: string) => {
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      };
      if (result.singleMp4) {
        const url = URL.createObjectURL(result.singleMp4);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.mp4`;
        a.click();
        revokeLater(url);
      }
      const zurl = URL.createObjectURL(result.zip);
      const za = document.createElement("a");
      za.href = zurl;
      za.download = `${base}_clips.zip`;
      za.click();
      revokeLater(zurl);
      toast.success("Cut assembled", {
        description: `${result.clipCount} clip(s)${
          result.omitted ? ` · ${result.omitted} omitted (cap)` : ""
        } — Mediabunny on-device`,
      });
    } catch (err) {
      toast.message("Assembly failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAssembling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/app/cutups"
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg-muted hover:text-fg focus-ring"
            aria-label="Back to cutups"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              Teach reel
            </p>
            <label className="sr-only" htmlFor="cutup-title">
              Cutup title
            </label>
            <Input
              id="cutup-title"
              value={editingTitle}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft != null) {
                  renameCutup(cutupId, titleDraft);
                  setTitleDraft(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="font-display h-auto border-transparent bg-transparent px-0 text-3xl font-semibold tracking-tight sm:text-4xl"
            />
            <p className="mt-1 text-sm text-fg-muted">
              {cutup.description || cutup.filterSummary} · {plural(plays.length, "play")} ·{" "}
              {formatClock(duration)}
              {queue.length > 0
                ? ` · clip ${safeIndex + 1}/${queue.length}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={autoAdvance ? "primary" : "secondary"}
            size="sm"
            onClick={() => setAutoAdvance((v) => !v)}
            aria-pressed={autoAdvance}
          >
            <SkipForward className="h-4 w-4" />
            Auto-advance {autoAdvance ? "on" : "off"}
          </Button>
          <Button
            type="button"
            variant={loop ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLoop((v) => !v)}
            aria-pressed={loop}
          >
            <Repeat className="h-4 w-4" />
            Loop {loop ? "on" : "off"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={assembling}
            onClick={() => void assembleMedia()}
          >
            <Clapperboard className="h-4 w-4" />
            {assembling ? "Assembling…" : "Assemble MP4/ZIP"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void share()}>
            <Link2 className="h-4 w-4" />
            Share link
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => exportFmt("csv")}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => exportFmt("json")}>
            JSON
          </Button>
        </div>
      </div>

      {clip ? (
        <VideoStage
          title={clip.filmTitle}
          opponent={clip.opponent}
          hue={clip.hue}
          currentSec={currentSec}
          durationSec={
            media
              ? Math.max(clip.film?.durationSec ?? clip.play.endSec, currentSec + 1)
              : (clip.film?.durationSec ?? clip.play.endSec)
          }
          playing={playing}
          speed={speed}
          mediaUrl={media?.objectUrl}
          playStartSec={clip.play.startSec}
          playEndSec={clip.play.endSec}
          playbackEpoch={playbackEpoch}
          onSpeedChange={setSpeed}
          playLabel={clip.label}
          onToggle={() => setPlaying((p) => !p)}
          onPrev={() => goToClip(safeIndex - 1)}
          onNext={() => goToClip(safeIndex + 1)}
          onTimeUpdate={(t) => {
            if (!media) return;
            if (timeRafRef.current != null) return;
            timeRafRef.current = requestAnimationFrame(() => {
              timeRafRef.current = null;
              setCurrentSec(t);
            });
          }}
          onEndedPlay={onClipEnded}
        />
      ) : (
        <div className="panel p-10 text-center text-sm text-fg-muted">
          No plays in this teach reel. Save a cutup from film review or create an install from
          stars.
        </div>
      )}

      {clip && !media && (
        <p className="text-xs text-fg-subtle">
          No local video for this clip&apos;s film — demo stage only.{" "}
          <Link
            to="/app/film/$filmId"
            params={{ filmId: clip.play.filmId }}
            className="underline hover:text-fg"
          >
            Attach media on film
          </Link>{" "}
          for real playback. Space · J/K · A auto-advance · L loop.
        </p>
      )}
      {clip && media && (
        <p className="text-xs text-fg-subtle">
          Teach mode: Space play/pause · J/K next/prev · A auto-advance · L loop. Media from{" "}
          {media.fileName}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Queue</h2>
          <PlayList
            plays={plays}
            selectedId={clip?.play.id ?? null}
            onSelect={(id) => {
              const idx = queue.findIndex((c) => c.play.id === id);
              if (idx >= 0) goToClip(idx);
            }}
          />
        </div>
        <div className="panel divide-y divide-border overflow-hidden">
          {plays.map((p) => {
            const film = films.find((f) => f.id === p.filmId);
            const active = clip?.play.id === p.id;
            const qIdx = queue.findIndex((c) => c.play.id === p.id);
            return (
              <div
                key={p.id}
                className={
                  active
                    ? "flex items-center justify-between gap-3 bg-bg-subtle px-4 py-3 text-sm"
                    : "flex items-center justify-between gap-3 px-4 py-3 text-sm"
                }
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:underline focus-ring rounded-sm"
                  onClick={() => {
                    if (qIdx >= 0) goToClip(qIdx);
                  }}
                >
                  <p className="font-medium">
                    {(qIdx >= 0 ? qIdx + 1 : "?")}. {film?.title ?? p.filmId} · Play{" "}
                    {p.index}
                  </p>
                  <p className="text-xs capitalize text-fg-muted">
                    {p.side}
                    {p.down != null ? ` · ${p.down}&${p.distance}` : ""} ·{" "}
                    {p.tags.find((t) => t.category === "concept")?.label ?? "untagged"}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  {p.yardsGained != null && (
                    <span className="tabular text-fg-muted">{formatYards(p.yardsGained)}</span>
                  )}
                  <Link
                    to="/app/film/$filmId"
                    params={{ filmId: p.filmId }}
                    className="text-xs text-fg-subtle hover:underline"
                    onClick={() => setMediaEpoch((n) => n + 1)}
                  >
                    Film
                  </Link>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] p-2 text-fg-subtle hover:bg-bg-subtle hover:text-fg focus-ring"
                    aria-label={`Remove play ${p.index} from cutup`}
                    onClick={() => {
                      removePlayFromCutup(cutupId, p.id);
                      toast.message("Play removed from cutup");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
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
