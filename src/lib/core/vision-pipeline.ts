/**
 * Local vision pipeline — open, pure, unit-tested.
 *
 * Not a YOLO black box: scene-change segmentation from lightweight frame stats
 * + heuristic tagging. Mirrors what a local FOSS CV sidecar would emit as OFP.
 * Heavy models (YOLO/ByteTrack) can plug into the same OFP contract later.
 */

import { applyAiToPlay } from "./tagging";
import type { Film, Play, Side } from "./types";
import { buildOpenFilmPackage, type OpenFilmPackage } from "./ofp";

export type FrameStat = {
  /** Seconds from film start */
  t: number;
  /** Mean luminance 0–255 */
  meanLuma: number;
  /** Mean abs frame-to-frame luma delta (0 if first) */
  deltaLuma: number;
};

export type VisionSegment = {
  startSec: number;
  endSec: number;
  /** Relative cut strength */
  cutScore: number;
};

/**
 * Detect play-like segments from frame stats via scene-change peaks.
 */
export function segmentFromFrameStats(
  frames: FrameStat[],
  opts: {
    durationSec: number;
    /** Absolute delta threshold (default 18) */
    threshold?: number;
    minSegmentSec?: number;
    maxSegmentSec?: number;
  },
): VisionSegment[] {
  const threshold = opts.threshold ?? 18;
  const minSeg = opts.minSegmentSec ?? 4;
  const maxSeg = opts.maxSegmentSec ?? 18;
  const duration = Math.max(opts.durationSec, 1);

  if (frames.length < 2) {
    return [{ startSec: 0, endSec: duration, cutScore: 0 }];
  }

  const cutTimes: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.deltaLuma >= threshold) {
      const t = f.t;
      const last = cutTimes[cutTimes.length - 1]!;
      if (t - last >= minSeg * 0.5) cutTimes.push(t);
    }
  }

  // Force max segment length
  const forced: number[] = [];
  for (let i = 0; i < cutTimes.length; i++) {
    const a = cutTimes[i]!;
    const b = cutTimes[i + 1] ?? duration;
    forced.push(a);
    let cursor = a + maxSeg;
    while (cursor < b - minSeg * 0.5) {
      forced.push(cursor);
      cursor += maxSeg;
    }
  }
  forced.push(duration);

  const uniq = Array.from(new Set(forced.map((t) => Math.round(t * 10) / 10))).sort(
    (a, b) => a - b,
  );

  const segments: VisionSegment[] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const startSec = uniq[i]!;
    const endSec = uniq[i + 1]!;
    if (endSec - startSec < minSeg * 0.6) continue;
    const mid = (startSec + endSec) / 2;
    const near = frames.reduce((best, f) =>
      Math.abs(f.t - mid) < Math.abs(best.t - mid) ? f : best,
    );
    segments.push({
      startSec,
      endSec,
      cutScore: near.deltaLuma,
    });
  }

  if (segments.length === 0) {
    return [{ startSec: 0, endSec: duration, cutScore: 0 }];
  }
  return segments;
}

/** Synthetic frame stats for offline / CLI demos (deterministic). */
export function syntheticFrameStats(durationSec: number, seed = 1): FrameStat[] {
  const frames: FrameStat[] = [];
  let prev = 100;
  for (let t = 0; t <= durationSec; t += 0.5) {
    // Periodic “snap” every ~8–12s + noise
    const phase = (t * 7 + seed * 13) % 11;
    const snap = phase < 0.55 ? 40 + (seed % 20) : 2 + ((t * 3 + seed) % 5);
    const meanLuma = 80 + ((Math.sin(t * 0.3 + seed) + 1) * 40);
    const deltaLuma = t === 0 ? 0 : Math.abs(meanLuma - prev) * 0.2 + snap;
    frames.push({ t, meanLuma, deltaLuma });
    prev = meanLuma;
  }
  return frames;
}

function sideFromIndex(i: number, seed: number): Side {
  const r = (i * 17 + seed * 3) % 10;
  if (r < 5) return "offense";
  if (r < 8) return "defense";
  return "special";
}

export function segmentsToPlays(
  filmId: string,
  segments: VisionSegment[],
  opts: { seed?: number; honest?: boolean } = {},
): Play[] {
  const seed = opts.seed ?? 1;
  if (opts.honest) {
    return segments.map((seg, i) => ({
      id: `${filmId}_p${i + 1}`,
      filmId,
      index: i + 1,
      startSec: Math.round(seg.startSec * 100) / 100,
      endSec: Math.round(seg.endSec * 100) / 100,
      quarter: 1,
      clock: "—",
      side: "offense" as const,
      tags: [],
      starred: false,
      notes:
        "Auto-split from scene cuts — confirm Inside/Outside run, jersey, and yards. Do not trust invented downs.",
    }));
  }

  return segments.map((seg, i) => {
    const side = sideFromIndex(i, seed);
    const down = (1 + (i % 4)) as 1 | 2 | 3 | 4;
    const distance = [10, 7, 5, 3, 12][i % 5];
    const yardsGained =
      side === "special" ? undefined : [-2, 0, 2, 4, 8, 15, 22][(i + seed) % 7];
    const visionHint =
      side === "offense"
        ? i % 3 === 0
          ? "shotgun trips inside zone left"
          : i % 3 === 1
            ? "pistol power right"
            : "shotgun stick concept"
        : side === "defense"
          ? i % 2 === 0
            ? "cover 3 sky pressure edge"
            : "cover 2 man underneath"
          : "punt formation";

    const base: Play = {
      id: `${filmId}_vis_${i + 1}`,
      filmId,
      index: i + 1,
      startSec: Math.round(seg.startSec * 100) / 100,
      endSec: Math.round(seg.endSec * 100) / 100,
      quarter: (1 + Math.min(3, Math.floor(i / 12))) as 1 | 2 | 3 | 4,
      clock: `${12 - (i % 12)}:00`,
      side,
      down: side === "special" ? undefined : down,
      distance: side === "special" ? undefined : distance,
      yardLine: 15 + ((i * 11) % 70),
      yardsGained,
      tags: [],
      notes: `Local vision cut (score ${seg.cutScore.toFixed(1)})`,
    };

    return applyAiToPlay(base, {
      side,
      down: base.down,
      distance: base.distance,
      yardLine: base.yardLine,
      yardsGained,
      visionHint,
      isExplosive: (yardsGained ?? 0) >= 15,
      isSpecial: side === "special",
    });
  });
}

/** Honest youth game split — scene cuts only, no invented situation. */
export function honestPlaysFromSegments(
  filmId: string,
  segments: VisionSegment[],
): Play[] {
  return segmentsToPlays(filmId, segments, { honest: true });
}

export function visionResultToOfp(input: {
  film: Pick<
    Film,
    | "id"
    | "title"
    | "opponent"
    | "week"
    | "season"
    | "date"
    | "venue"
    | "level"
    | "durationSec"
    | "status"
    | "sourceFileName"
  >;
  frames: FrameStat[];
  seed?: number;
  now?: Date;
  /** When true, no invented downs/yards/formations (youth / school game film). */
  honest?: boolean;
}): { package: OpenFilmPackage; plays: Play[]; segments: VisionSegment[] } {
  const segments = segmentFromFrameStats(input.frames, {
    durationSec: input.film.durationSec,
    minSegmentSec: input.honest ? 5 : 4,
    maxSegmentSec: input.honest ? 25 : 18,
  });
  const plays = segmentsToPlays(input.film.id, segments, {
    seed: input.seed,
    honest: input.honest,
  });
  const film: Film = {
    ...input.film,
    status: "needs_review",
    aiProgress: 100,
    playCount: plays.length,
    tagCount: plays.reduce((n, p) => n + p.tags.length, 0),
    thumbnailHue: 210,
    createdAt: (input.now ?? new Date()).toISOString(),
    isUpload: true,
  };
  const pkg = buildOpenFilmPackage({
    films: [film],
    plays,
    now: input.now,
    generator: input.honest
      ? "PlayIQ local-vision-honest"
      : "PlayIQ local-vision-sidecar",
  });
  return { package: pkg, plays, segments };
}
