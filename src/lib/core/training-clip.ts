/**
 * Optional bundled training clips.
 * Public repo ships none — do not commit youth/student film to git.
 */

import { applyAiToPlay, mergeTags } from "./tagging";
import type { Film, Play, PlayResult, PlayTag, TagCategory } from "./types";

/** Generic jersey key for demos — override per school in private config if needed. */
export const JERSEY_KEY = {
  white: "Team A",
  maroon: "Team B",
  summary: "Jersey colors set by your school",
} as const;

function coachTag(category: TagCategory, label: string): PlayTag {
  return {
    id: `coach:${category}:${label.toLowerCase().replace(/\s+/g, "_")}`,
    category,
    label,
    source: "coach",
  };
}

export type TrainingClipDef = {
  id: string;
  title: string;
  opponent: string;
  sourceFileName: string;
  sourceUrl: string;
  posterUrl: string;
  durationSec: number;
  orientation: "portrait" | "landscape";
  thumbnailHue: number;
  visionHint: string;
  notes: string;
  result?: PlayResult;
  yardsGained?: number;
  side: Play["side"];
  offenseJersey: "white" | "maroon";
};

/** Empty in the public product. Add clips only in a private fork/deploy. */
export const TRAINING_CLIPS: TrainingClipDef[] = [];

export const TRAINING_CLIP_ID = "";
export const TRAINING_CLIP_URL = "";
export const TRAINING_POSTER_URL = "";
export const TRAINING_CLIP_DURATION = 0;

export function isTrainingClipId(id: string): boolean {
  return TRAINING_CLIPS.some((c) => c.id === id);
}

export function createTrainingFilmFromDef(
  def: TrainingClipDef,
  now = new Date(),
): { film: Film; plays: Play[] } {
  const offenseGrade = JERSEY_KEY[def.offenseJersey];
  const defenseGrade = def.offenseJersey === "white" ? JERSEY_KEY.maroon : JERSEY_KEY.white;

  const film: Film = {
    id: def.id,
    title: def.title,
    opponent: def.opponent,
    week: 0,
    season: String(now.getFullYear()),
    date: now.toISOString().slice(0, 10),
    venue: "home",
    level: "youth",
    durationSec: def.durationSec,
    status: "needs_review",
    aiProgress: 100,
    playCount: 1,
    tagCount: 0,
    thumbnailHue: def.thumbnailHue,
    createdAt: now.toISOString(),
    sourceFileName: def.sourceFileName,
    isUpload: true,
    sourceUrl: def.sourceUrl,
    posterUrl: def.posterUrl,
    orientation: def.orientation,
  };

  const base: Play = {
    id: `${def.id}_p1`,
    filmId: def.id,
    index: 1,
    startSec: 0,
    endSec: def.durationSec,
    quarter: 1,
    clock: "—",
    side: def.side,
    result: def.result,
    yardsGained: def.yardsGained,
    tags: [],
    starred: false,
    notes: def.notes,
  };

  const play = applyAiToPlay(base, {
    side: def.side,
    yardsGained: def.yardsGained,
    visionHint: def.visionHint,
  });

  play.tags = mergeTags(play.tags, [
    coachTag("personnel", offenseGrade),
    coachTag("coach_note", `${def.offenseJersey} offense`),
    coachTag("coach_note", `vs ${defenseGrade}`),
  ]);

  return { film, plays: [play] };
}

export function createAllTrainingFilms(now = new Date()): Array<{ film: Film; plays: Play[] }> {
  return TRAINING_CLIPS.map((def) => createTrainingFilmFromDef(def, now));
}

export function createTrainingSidelineFilm(now = new Date()): { film: Film; plays: Play[] } | null {
  const first = TRAINING_CLIPS[0];
  if (!first) return null;
  return createTrainingFilmFromDef(first, now);
}

export function playsForTrainingFilm(filmId: string, createdAt?: string): Play[] | null {
  const def = TRAINING_CLIPS.find((c) => c.id === filmId);
  if (!def) return null;
  return createTrainingFilmFromDef(def, createdAt ? new Date(createdAt) : new Date()).plays;
}
