/**
 * Teach reel queue — ordered cutup playback with auto-advance.
 * Pure domain: no React / media registry deps.
 */

import type { Film, Play } from "./types";

export type TeachClip = {
  /** Position in the teach queue (0-based) */
  queueIndex: number;
  play: Play;
  film: Film | null;
  filmTitle: string;
  opponent: string;
  hue: number;
  label: string;
};

export type TeachAdvance =
  | { kind: "clip"; queueIndex: number }
  | { kind: "end" }
  | { kind: "loop"; queueIndex: 0 };

/** Build ordered teach clips from cutup play ids. */
export function buildTeachQueue(input: {
  playIds: string[];
  plays: Play[];
  films: Film[];
}): TeachClip[] {
  const byId = new Map(input.plays.map((p) => [p.id, p]));
  const filmMap = new Map(input.films.map((f) => [f.id, f]));
  const clips: TeachClip[] = [];
  let queueIndex = 0;

  for (const id of input.playIds) {
    const play = byId.get(id);
    if (!play) continue;
    const film = filmMap.get(play.filmId) ?? null;
    const concept =
      play.tags.find((t) => t.category === "concept")?.label ??
      play.tags.find((t) => t.category === "formation")?.label;
    const situation =
      play.down != null
        ? `${play.down}&${play.distance ?? "?"}`
        : play.side;
    clips.push({
      queueIndex,
      play,
      film,
      filmTitle: film?.title ?? play.filmId,
      opponent: film?.opponent ?? "",
      hue: film?.thumbnailHue ?? 210,
      label: `Clip ${queueIndex + 1} · Play ${play.index} · ${situation}${concept ? ` · ${concept}` : ""}`,
    });
    queueIndex += 1;
  }

  return clips;
}

/**
 * Next step after a clip ends.
 * - autoAdvance off → end (pause)
 * - last clip + loop → restart
 * - last clip + no loop → end
 * - otherwise next index
 */
export function advanceTeachQueue(input: {
  queueIndex: number;
  queueLength: number;
  autoAdvance: boolean;
  loop: boolean;
}): TeachAdvance {
  if (input.queueLength <= 0) return { kind: "end" };
  if (!input.autoAdvance) return { kind: "end" };

  const atLast = input.queueIndex >= input.queueLength - 1;
  if (atLast) {
    if (input.loop) return { kind: "loop", queueIndex: 0 };
    return { kind: "end" };
  }
  return { kind: "clip", queueIndex: input.queueIndex + 1 };
}

export function teachQueueDurationSec(clips: TeachClip[]): number {
  return clips.reduce(
    (sum, c) => sum + Math.max(0, c.play.endSec - c.play.startSec),
    0,
  );
}

/** Clamp index into queue bounds. */
export function clampQueueIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}
