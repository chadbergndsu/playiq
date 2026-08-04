import { Pause, Play, SkipBack, SkipForward, Video } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

/** Film stage: real HTML5 video when media is registered, demo field otherwise. */
export function VideoStage({
  title,
  opponent,
  hue,
  currentSec,
  durationSec,
  playing,
  playLabel,
  speed,
  mediaUrl,
  vttUrl,
  playStartSec,
  playEndSec,
  onSpeedChange,
  onToggle,
  onPrev,
  onNext,
  onTimeUpdate,
  onEndedPlay,
}: {
  title: string;
  opponent: string;
  hue: number;
  currentSec: number;
  durationSec: number;
  playing: boolean;
  playLabel: string;
  speed: PlaybackSpeed;
  /** Object URL for local registered media */
  mediaUrl?: string | null;
  /** Object URL for WebVTT chapters track */
  vttUrl?: string | null;
  /** Clamp / seek window for current play */
  playStartSec?: number;
  playEndSec?: number;
  onSpeedChange: (s: PlaybackSpeed) => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTimeUpdate?: (sec: number) => void;
  /** Fired when real video hits play end */
  onEndedPlay?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasMedia = Boolean(mediaUrl);
  const start = playStartSec ?? 0;
  const end = playEndSec ?? durationSec;

  // Sync play / pause / rate
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia) return;
    v.playbackRate = speed;
    if (playing) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [playing, speed, hasMedia, mediaUrl]);

  // Seek when play selection / scrub changes (avoid fighting while playing)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia) return;
    if (Math.abs(v.currentTime - currentSec) > 0.35) {
      v.currentTime = Math.max(0, currentSec);
    }
  }, [currentSec, hasMedia, start, end]);

  // When play bounds change, jump to start
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia) return;
    v.currentTime = start;
  }, [start, hasMedia, mediaUrl]);

  return (
    <div className="panel overflow-hidden">
      <div
        className="relative aspect-video w-full bg-bg"
        style={
          hasMedia
            ? undefined
            : {
                background: `radial-gradient(ellipse at 50% 40%, hsl(${hue} 14% 22%) 0%, #0a0b0d 70%)`,
              }
        }
      >
        {hasMedia ? (
          <video
            ref={videoRef}
            key={mediaUrl ?? "none"}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            src={mediaUrl ?? undefined}
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              onTimeUpdate?.(t);
              if (t >= end - 0.05) {
                e.currentTarget.pause();
                onEndedPlay?.();
              }
            }}
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = start;
            }}
          >
            {vttUrl ? (
              <track
                kind="chapters"
                srcLang="en"
                label="Plays"
                src={vttUrl}
                default
              />
            ) : null}
          </video>
        ) : (
          <>
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
          </>
        )}

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-[var(--radius-sm)] bg-bg/70 px-2.5 py-1 text-xs text-fg-muted backdrop-blur-sm">
          {hasMedia ? (
            <>
              <Video className="h-3.5 w-3.5" />
              Local film · {title}
            </>
          ) : (
            <>Demo film stage · {title}</>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-semibold sm:text-4xl drop-shadow">
              {opponent}
            </p>
            <p className="text-sm text-fg-muted drop-shadow">{playLabel}</p>
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
        <Button
          type="button"
          variant="primary"
          size="icon"
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="secondary" size="icon" onClick={onNext} aria-label="Next play">
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="ml-1 flex items-center gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={
                speed === s
                  ? "h-8 rounded-[var(--radius-sm)] bg-fg px-2 text-xs font-medium tabular text-bg"
                  : "h-8 rounded-[var(--radius-sm)] border border-border px-2 text-xs font-medium tabular text-fg-muted hover:text-fg"
              }
            >
              {s}x
            </button>
          ))}
        </div>

        <p className="ml-auto text-xs text-fg-subtle">
          {hasMedia ? "Live local media · " : ""}
          J/K · Space · S star · ? help
        </p>
      </div>
    </div>
  );
}
