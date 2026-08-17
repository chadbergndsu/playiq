/**
 * Local phone-clip or full-game upload intake.
 * Clip = one play. Game = shell awaiting local scene-cut split (no invented tags).
 */

import type { Film, Play, Venue } from "./types";

export type UploadMode = "clip" | "game";

export type UploadFilmInput = {
  opponent: string;
  week: number;
  season?: string;
  venue?: Venue;
  fileName?: string;
  /** Optional duration hint from browser metadata (seconds). */
  durationSec?: number;
  now?: Date;
  /** Optional coach title override. */
  title?: string;
  /** clip = one play; game = empty shell for auto-split */
  mode?: UploadMode;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Creates a youth film.
 * - clip: single play spanning the whole file
 * - game: zero plays until local vision fills them in
 */
export function createUploadedFilm(input: UploadFilmInput): {
  film: Film;
  plays: Play[];
} {
  const now = input.now ?? new Date();
  const mode: UploadMode = input.mode === "game" ? "game" : "clip";
  const opponent = input.opponent.trim() || "Opponent";
  const week = Math.min(20, Math.max(0, Math.floor(input.week) || 1));
  const id = `film_up_${now.getTime().toString(36)}_${hash(opponent).toString(36).slice(0, 4)}`;
  const rawDuration = input.durationSec;
  const durationSec =
    rawDuration != null && Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.min(4 * 60 * 60, Math.max(0.5, rawDuration))
      : mode === "game"
        ? 3600
        : 8;
  const season = input.season?.trim() || String(now.getFullYear());
  const title =
    input.title?.trim() ||
    (mode === "game" ? `vs ${opponent}` : `vs ${opponent} — clip`);

  const film: Film = {
    id,
    title,
    opponent,
    week,
    season,
    date: now.toISOString().slice(0, 10),
    venue: input.venue ?? "home",
    level: "youth",
    durationSec,
    status: "processing",
    aiProgress: mode === "game" ? 5 : 15,
    playCount: mode === "game" ? 0 : 1,
    tagCount: 0,
    thumbnailHue: (hash(opponent) % 40) + 200,
    createdAt: now.toISOString(),
    sourceFileName: input.fileName?.trim() || undefined,
    isUpload: true,
  };

  if (mode === "game") {
    return { film, plays: [] };
  }

  const play: Play = {
    id: `${id}_p1`,
    filmId: id,
    index: 1,
    startSec: 0,
    endSec: durationSec,
    quarter: 1,
    clock: "—",
    side: "offense",
    tags: [],
    starred: false,
    notes:
      "Phone clip — confirm concept (Inside run vs Outside run), jersey numbers, and yards before treating as locked.",
  };

  return { film, plays: [play] };
}

/** Mark an uploaded film ready for coach review (no fake AI tags). */
export function finalizeUploadedFilm(film: Film): Film {
  return {
    ...film,
    status: "needs_review",
    aiProgress: 100,
  };
}
