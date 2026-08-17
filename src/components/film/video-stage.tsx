import { Pause, Play, SkipBack, SkipForward, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TrackingArtifact } from "@/lib/core/tracking";
import { formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TrackingOverlay } from "./tracking-overlay";

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
  /** Bump to force reseek + resume (auto-advance / loop). */
  playbackEpoch = 0,
  orientation = "landscape",
  trackingArtifact,
  trackingEnabled = false,
  confirmedJerseys,
  onConfirmJersey,
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
  mediaUrl?: string | null;
  vttUrl?: string | null;
  playStartSec?: number;
  playEndSec?: number;
  playbackEpoch?: number;
  orientation?: "portrait" | "landscape";
  trackingArtifact?: TrackingArtifact | null;
  trackingEnabled?: boolean;
  confirmedJerseys?: number[];
  onConfirmJersey?: (number: number, confidence: number) => void;
  onSpeedChange: (s: PlaybackSpeed) => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTimeUpdate?: (sec: number) => void;
  onEndedPlay?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const endedLatchRef = useRef(false);
  const hasMedia = Boolean(mediaUrl);
  const start = playStartSec ?? 0;
  const end = playEndSec ?? durationSec;

  // Reset end-latch when bounds / media / epoch change
  useEffect(() => {
    endedLatchRef.current = false;
  }, [start, end, mediaUrl, playbackEpoch]);

  // Sync play / pause / rate + resume after clip advance (epoch)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia) return;
    v.playbackRate = speed;
    if (playing) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [playing, speed, hasMedia, mediaUrl, playbackEpoch]);

  // Seek on selection / epoch (not every scrub tick while playing)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia) return;
    const target = Math.max(0, start);
    const apply = () => {
      if (Math.abs(v.currentTime - target) > 0.08) {
        v.currentTime = target;
      }
      if (playing) {
        void v.play().catch(() => undefined);
      }
    };
    apply();
  }, [start, end, hasMedia, mediaUrl, playbackEpoch]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: don't seek on every currentSec

  // Controlled scrub when paused (parent currentSec)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMedia || playing) return;
    if (Math.abs(v.currentTime - currentSec) > 0.35) {
      v.currentTime = Math.max(0, currentSec);
    }
  }, [currentSec, hasMedia, playing]);

  function fireEndedOnce() {
    if (endedLatchRef.current) return;
    endedLatchRef.current = true;
    const v = videoRef.current;
    if (v) v.pause();
    onEndedPlay?.();
  }

  return (
    <div className="panel overflow-hidden">
      <div
        className={
          hasMedia && orientation === "portrait"
            ? "relative mx-auto aspect-[9/16] w-full max-h-[min(58vh,640px)] max-w-[360px] bg-black"
            : "relative aspect-video w-full bg-bg"
        }
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
              const v = e.currentTarget;
              const t = v.currentTime;
              const mediaEnd = Number.isFinite(v.duration) ? v.duration : end;
              const clipEnd = Math.min(end, mediaEnd);
              onTimeUpdate?.(t);
              if (!endedLatchRef.current && t >= clipEnd - 0.05) {
                fireEndedOnce();
              }
            }}
            onEnded={() => {
              fireEndedOnce();
            }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              video.currentTime = start;
              setVideoSize({ width: video.videoWidth, height: video.videoHeight });
            }}
          >
            {vttUrl ? (
              <track kind="chapters" srcLang="en" label="Plays" src={vttUrl} default />
            ) : null}
          </video>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-fg-muted">
            <Video className="h-10 w-10 opacity-40" />
            <p className="text-sm">
              {title} · {opponent}
            </p>
            <p className="text-xs text-fg-subtle">Demo stage — attach media for real video</p>
          </div>
        )}
        {hasMedia && trackingEnabled && trackingArtifact ? (
          <TrackingOverlay
            artifact={trackingArtifact}
            currentSec={currentSec}
            displayWidth={videoSize?.width}
            displayHeight={videoSize?.height}
            confirmedJerseys={confirmedJerseys}
            onConfirmJersey={onConfirmJersey}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
        <Button type="button" variant="ghost" size="sm" onClick={onPrev} aria-label="Previous play">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onNext} aria-label="Next play">
          <SkipForward className="h-4 w-4" />
        </Button>
        <span className="tabular text-xs text-fg-muted sm:text-sm">
          {formatClock(currentSec)} / {formatClock(durationSec)}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-subtle sm:inline">
          {playLabel}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={
                speed === s
                  ? "h-7 rounded-full bg-fg px-2 text-xs font-medium text-bg"
                  : "h-7 rounded-full px-2 text-xs font-medium text-fg-muted hover:bg-bg-subtle"
              }
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
