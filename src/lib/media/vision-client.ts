/**
 * Browser local-vision pass: sample frames via Mediabunny, segment, emit OFP.
 */

import {
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
  Input,
} from "mediabunny";
import {
  type FrameStat,
  syntheticFrameStats,
  visionResultToOfp,
} from "@/lib/core/vision-pipeline";
import type { OpenFilmPackage } from "@/lib/core/ofp";
import type { Film } from "@/lib/core/types";

function meanLumaFromCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): number {
  const w = Math.min(64, canvas.width);
  const h = Math.min(36, canvas.height);
  if (w < 1 || h < 1) return 0;

  // Draw scaled into analysis canvas
  const probe =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  probe.width = w;
  probe.height = h;
  const ctx = probe.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) return 0;
  ctx.drawImage(canvas as CanvasImageSource, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let sum = 0;
  const n = w * h;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
  }
  return sum / n;
}

/**
 * Sample frame stats from a video blob (WebCodecs decode path).
 * Falls back to synthetic stats if sampling fails.
 */
export async function sampleFrameStats(
  blob: Blob,
  opts: {
    stepSec?: number;
    maxFrames?: number;
    onProgress?: (ratio: number) => void;
  } = {},
): Promise<{ frames: FrameStat[]; durationSec: number; mode: "sampled" | "synthetic" }> {
  const step = opts.stepSec ?? 0.5;
  const maxFrames = opts.maxFrames ?? 400;

  let input: Input | null = null;
  try {
    input = new Input({
      source: new BlobSource(blob),
      formats: ALL_FORMATS,
    });
    const durationSec = await input.computeDuration();
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Invalid media duration");
    }
    const video = await input.getPrimaryVideoTrack();
    if (!video) {
      return {
        frames: syntheticFrameStats(durationSec, blob.size % 97),
        durationSec,
        mode: "synthetic",
      };
    }

    const sink = new CanvasSink(video, { width: 64, height: 36 });
    const frames: FrameStat[] = [];
    let prev = 0;
    let i = 0;
    for (let t = 0; t < durationSec && i < maxFrames; t += step, i++) {
      const wrapped = await sink.getCanvas(t);
      if (wrapped) {
        const canvas = wrapped.canvas as HTMLCanvasElement | OffscreenCanvas;
        const meanLuma = meanLumaFromCanvas(canvas);
        const deltaLuma = frames.length === 0 ? 0 : Math.abs(meanLuma - prev);
        frames.push({ t, meanLuma, deltaLuma });
        prev = meanLuma;
      } else if (frames.length > 0) {
        frames.push({ t, meanLuma: prev, deltaLuma: 0 });
      }
      opts.onProgress?.(Math.min(1, t / durationSec));
    }

    if (frames.length < 2) {
      return {
        frames: syntheticFrameStats(durationSec, blob.size % 97),
        durationSec,
        mode: "synthetic",
      };
    }
    return { frames, durationSec, mode: "sampled" };
  } catch (err) {
    // Prefer probing duration via HTMLVideoElement; never invent a 10-minute game.
    const durationSec = await probeDurationFallback(blob).catch(() => 0);
    if (durationSec <= 0) {
      throw err instanceof Error
        ? err
        : new Error("Could not sample or probe media duration");
    }
    return {
      frames: syntheticFrameStats(durationSec, blob.size % 97),
      durationSec,
      mode: "synthetic",
    };
  } finally {
    const anyIn = input as unknown as { dispose?: () => void; destroy?: () => void } | null;
    anyIn?.dispose?.();
    anyIn?.destroy?.();
  }
}

function probeDurationFallback(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No DOM for duration probe"));
      return;
    }
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      cleanup();
      if (Number.isFinite(d) && d > 0) resolve(d);
      else reject(new Error("Empty duration"));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Video metadata probe failed"));
    };
    video.src = url;
  });
}

/** Public duration probe for upload UI / game split planning. */
export async function probeVideoDuration(blob: Blob): Promise<number | undefined> {
  try {
    const d = await probeDurationFallback(blob);
    return d > 0 ? d : undefined;
  } catch {
    return undefined;
  }
}

export async function runLocalVisionToOfp(
  blob: Blob,
  meta: {
    opponent: string;
    week: number;
    fileName?: string;
    filmId?: string;
    venue?: Film["venue"];
    level?: Film["level"];
    /** Honest youth split — no invented downs/yards/formations */
    honest?: boolean;
  },
  onProgress?: (msg: string, ratio?: number) => void,
): Promise<{
  package: OpenFilmPackage;
  mode: "sampled" | "synthetic";
  playCount: number;
  plays: import("@/lib/core/types").Play[];
  durationSec: number;
}> {
  onProgress?.("Reading video…", 0.02);
  const approxDur = (await probeVideoDuration(blob)) ?? 0;
  const stepSec = approxDur > 2400 ? 2 : approxDur > 900 ? 1 : 0.5;
  const maxFrames = Math.min(
    1800,
    Math.max(80, Math.ceil((approxDur || 600) / stepSec) + 4),
  );

  onProgress?.("Sampling frames…", 0.05);
  const { frames, durationSec, mode } = await sampleFrameStats(blob, {
    stepSec,
    maxFrames,
    onProgress: (r) => onProgress?.("Sampling frames…", 0.05 + r * 0.7),
  });

  const now = new Date();
  const id =
    meta.filmId ??
    `film_vis_${now.getTime().toString(36)}_${(blob.size % 1e6).toString(36)}`;
  const film: Film = {
    id,
    title: `vs ${meta.opponent.trim() || "Opponent"}`,
    opponent: meta.opponent.trim() || "Opponent",
    week: meta.week,
    season: String(now.getFullYear()),
    date: now.toISOString().slice(0, 10),
    venue: meta.venue ?? "home",
    level: meta.level ?? (meta.honest ? "youth" : "varsity"),
    durationSec,
    status: "needs_review",
    aiProgress: 100,
    playCount: 0,
    tagCount: 0,
    thumbnailHue: 210,
    createdAt: now.toISOString(),
    sourceFileName: meta.fileName,
    isUpload: true,
  };

  onProgress?.(meta.honest ? "Splitting plays…" : "Segmenting + tagging…", 0.85);
  const { package: pkg, plays } = visionResultToOfp({
    film,
    frames,
    seed: blob.size % 97,
    now,
    honest: meta.honest,
  });
  onProgress?.("Done", 1);
  return { package: pkg, mode, playCount: plays.length, plays, durationSec };
}
