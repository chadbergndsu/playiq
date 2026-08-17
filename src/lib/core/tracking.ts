/**
 * Portable tracking contract shared by the local Python sidecar and film UI.
 * Coordinates are normalized to the source video (0..1).
 */

export type TrackingKind = "player" | "ball";

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TrackingDetection = {
  trackId: string;
  kind: TrackingKind;
  box: NormalizedBox;
  confidence: number;
  /** OCR suggestion only; never a coach lock without confirmation. */
  jerseyNumber?: number;
  jerseyConfidence?: number;
};

export type TrackingFrame = {
  t: number;
  detections: TrackingDetection[];
};

export type TrackingArtifact = {
  version: 1;
  filmId: string;
  sourceFileName: string;
  width: number;
  height: number;
  analyzedFps: number;
  durationSec: number;
  model: string;
  createdAt: string;
  frames: TrackingFrame[];
  warnings: string[];
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeBox(box: NormalizedBox): NormalizedBox {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  return {
    x,
    y,
    width: Math.min(1 - x, Math.max(0, box.width)),
    height: Math.min(1 - y, Math.max(0, box.height)),
  };
}

/** Closest analyzed frame within tolerance; avoids stale boxes across cuts. */
export function trackingFrameAt(
  artifact: TrackingArtifact | null | undefined,
  timeSec: number,
  toleranceSec?: number,
): TrackingFrame | null {
  if (!artifact || artifact.frames.length === 0) return null;
  const tolerance = toleranceSec ?? Math.max(0.2, 0.75 / artifact.analyzedFps);

  let lo = 0;
  let hi = artifact.frames.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = artifact.frames[mid]!.t;
    if (t < timeSec) lo = mid + 1;
    else hi = mid - 1;
  }

  const candidates = [artifact.frames[lo], artifact.frames[lo - 1]].filter(
    (frame): frame is TrackingFrame => Boolean(frame),
  );
  const closest = candidates.reduce<TrackingFrame | null>((best, frame) => {
    if (!best) return frame;
    return Math.abs(frame.t - timeSec) < Math.abs(best.t - timeSec) ? frame : best;
  }, null);

  return closest && Math.abs(closest.t - timeSec) <= tolerance ? closest : null;
}

export function jerseySuggestionsForWindow(
  artifact: TrackingArtifact | null | undefined,
  startSec: number,
  endSec: number,
): Array<{ number: number; confidence: number; sightings: number }> {
  if (!artifact) return [];
  const byNumber = new Map<number, { sum: number; sightings: number }>();
  for (const frame of artifact.frames) {
    if (frame.t < startSec || frame.t > endSec) continue;
    for (const detection of frame.detections) {
      if (
        detection.kind !== "player" ||
        detection.jerseyNumber == null ||
        detection.jerseyConfidence == null
      ) {
        continue;
      }
      const row = byNumber.get(detection.jerseyNumber) ?? { sum: 0, sightings: 0 };
      row.sum += detection.jerseyConfidence;
      row.sightings += 1;
      byNumber.set(detection.jerseyNumber, row);
    }
  }
  return Array.from(byNumber, ([number, row]) => ({
    number,
    confidence: row.sum / row.sightings,
    sightings: row.sightings,
  })).sort((a, b) => b.confidence - a.confidence || b.sightings - a.sightings);
}

/** Merge a newly analyzed play window into the film's existing local artifact. */
export function mergeTrackingArtifacts(
  existing: TrackingArtifact | null | undefined,
  incoming: TrackingArtifact,
  replaceWindow?: { startSec: number; endSec: number },
): TrackingArtifact {
  if (!existing || existing.filmId !== incoming.filmId) return incoming;
  const incomingStart =
    replaceWindow?.startSec ?? incoming.frames[0]?.t ?? Number.POSITIVE_INFINITY;
  const incomingEnd =
    replaceWindow?.endSec ??
    incoming.frames[incoming.frames.length - 1]?.t ??
    Number.NEGATIVE_INFINITY;
  const kept = existing.frames.filter((frame) => frame.t < incomingStart || frame.t > incomingEnd);
  return {
    ...incoming,
    frames: [...kept, ...incoming.frames].sort((a, b) => a.t - b.t),
    warnings: Array.from(new Set([...existing.warnings, ...incoming.warnings])),
  };
}
