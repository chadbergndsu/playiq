/**
 * Local film upload intake — creates a film shell + placeholder plays.
 * Real encode/object storage stays future work; this unblocks coach workflow.
 */

import { applyAiToPlay } from "./tagging";
import type { Film, Play, Venue } from "./types";

export type UploadFilmInput = {
  opponent: string;
  week: number;
  season?: string;
  venue?: Venue;
  fileName?: string;
  /** Optional duration hint from browser metadata (seconds). */
  durationSec?: number;
  now?: Date;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function createUploadedFilm(input: UploadFilmInput): {
  film: Film;
  plays: Play[];
} {
  const now = input.now ?? new Date();
  const opponent = input.opponent.trim() || "Opponent";
  const week = Math.min(20, Math.max(1, Math.floor(input.week) || 1));
  const id = `film_up_${now.getTime().toString(36)}_${hash(opponent).toString(36).slice(0, 4)}`;
  const durationSec = Math.max(
    600,
    Math.min(4 * 60 * 60, Math.floor(input.durationSec ?? 5400)),
  );
  const playCount = 12;
  const season = input.season?.trim() || String(now.getFullYear());

  const film: Film = {
    id,
    title: `vs ${opponent}`,
    opponent,
    week,
    season,
    date: now.toISOString().slice(0, 10),
    venue: input.venue ?? "home",
    level: "varsity",
    durationSec,
    status: "processing",
    aiProgress: 15,
    playCount,
    tagCount: 0,
    thumbnailHue: (hash(opponent) % 40) + 200,
    createdAt: now.toISOString(),
    sourceFileName: input.fileName?.trim() || undefined,
    isUpload: true,
  };

  const plays: Play[] = [];
  const slot = Math.max(8, Math.floor((durationSec - 60) / playCount));
  for (let i = 0; i < playCount; i++) {
    const startSec = 20 + i * slot;
    const endSec = Math.min(durationSec - 5, startSec + 8);
    const sideRoll = hash(`${id}:${i}`) % 10;
    const side = sideRoll < 6 ? "offense" : sideRoll < 9 ? "defense" : "special";
    const base: Play = {
      id: `${id}_p${i + 1}`,
      filmId: id,
      index: i + 1,
      startSec,
      endSec,
      quarter: (1 + Math.min(3, Math.floor(i / 3))) as 1 | 2 | 3 | 4,
      clock: `${12 - (i % 12)}:00`,
      side,
      down: side === "special" ? undefined : ((1 + (i % 4)) as 1 | 2 | 3 | 4),
      distance: side === "special" ? undefined : [10, 7, 5, 3, 12][i % 5],
      yardLine: 20 + ((i * 7) % 60),
      yardsGained: side === "special" ? undefined : [2, 4, -1, 8, 15, 0][i % 6],
      tags: [],
      starred: false,
    };
    // Light first-pass so upload isn't an empty shell
    plays.push(
      applyAiToPlay(base, {
        side: base.side,
        down: base.down,
        distance: base.distance,
        yardLine: base.yardLine,
        yardsGained: base.yardsGained,
        visionHint:
          side === "offense"
            ? "shotgun trips inside zone"
            : side === "defense"
              ? "cover 3 pressure"
              : "punt formation",
        isExplosive: (base.yardsGained ?? 0) >= 15,
        isSpecial: side === "special",
      }),
    );
  }

  return { film, plays };
}

/** Mark an uploaded film ready after simulated encode/AI. */
export function finalizeUploadedFilm(film: Film): Film {
  return {
    ...film,
    status: "needs_review",
    aiProgress: 100,
  };
}
