/**
 * Deterministic demo film library for coaches — no network.
 */

import { applyAiToPlay } from "./tagging";
import type { RawPlaySignal } from "./tagging";
import type { Film, Play, Side } from "./types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(seed: number, arr: T[]): T {
  return arr[seed % arr.length]!;
}

const OPPONENTS = [
  "Westfield",
  "Oak Ridge",
  "Lincoln Prep",
  "Northview",
  "Summit Christian",
  "Riverdale",
  "Cedar Creek",
  "Metro Tech",
];

const VISION_HINTS_OFF = [
  "shotgun trips inside zone left",
  "pistol 11 personnel power right",
  "shotgun empty mesh concept",
  "under center i-form counter",
  "shotgun RPO glance",
  "shotgun four verticals",
  "shotgun boot right flood",
  "shotgun screen left",
  "goal line heavy power",
  "shotgun stick concept",
];

const VISION_HINTS_DEF = [
  "cover 3 sky pressure edge",
  "cover 2 man underneath",
  "blitz edge cover 1",
  "tampa 2 soft",
  "press man zero blitz",
  "cover 3 beater response",
];

const VISION_SPECIAL = ["punt formation", "field goal unit", "kickoff coverage"];

export function seedFilms(now = new Date()): Film[] {
  const season = "2025";
  return OPPONENTS.map((opponent, i) => {
    const id = `film_${i + 1}`;
    const week = i + 1;
    const d = new Date(now);
    d.setDate(d.getDate() - (OPPONENTS.length - i) * 7);
    const ready = i < 6;
    const playCount = 48 + (hash(id) % 25);
    const status = !ready ? "processing" : i === 5 ? "needs_review" : "ready";
    return {
      id,
      title: `vs ${opponent}`,
      opponent,
      week,
      season,
      date: d.toISOString().slice(0, 10),
      venue: i % 3 === 0 ? "away" : i % 3 === 1 ? "home" : "neutral",
      level: "varsity",
      durationSec: 5400 + (hash(id) % 900),
      status,
      aiProgress: status === "processing" ? 35 + (hash(id) % 40) : 100,
      playCount,
      tagCount: 0,
      thumbnailHue: (hash(opponent) % 40) + 200,
      createdAt: d.toISOString(),
    } satisfies Film;
  });
}

function buildPlay(
  filmId: string,
  index: number,
  startSec: number,
  endSec: number,
): Play {
  const seed = hash(`${filmId}:${index}`);
  const sideRoll = seed % 10;
  const side: Side = sideRoll < 5 ? "offense" : sideRoll < 8 ? "defense" : "special";
  const down = (1 + (seed % 4)) as 1 | 2 | 3 | 4;
  const distance = pick(seed, [1, 2, 3, 4, 5, 7, 8, 10, 12, 15]);
  const yardLine = 10 + (seed % 80);
  const yardsGained =
    side === "special"
      ? 0
      : side === "offense"
        ? pick(seed >> 2, [-4, -2, 0, 1, 2, 3, 4, 5, 7, 9, 12, 18, 28, 45])
        : pick(seed >> 3, [-8, -3, 0, 2, 4, 6, 10]);

  const isScore = yardsGained >= 28 && side === "offense";
  const isTurnover = seed % 37 === 0 && side !== "special";
  const isExplosive = Math.abs(yardsGained) >= 15;
  const isSpecial = side === "special";

  const visionHint =
    side === "offense"
      ? pick(seed, VISION_HINTS_OFF)
      : side === "defense"
        ? pick(seed, VISION_HINTS_DEF)
        : pick(seed, VISION_SPECIAL);

  const quarter = (1 + Math.min(3, Math.floor((index - 1) / 14))) as 1 | 2 | 3 | 4;
  const clockMin = 14 - ((index - 1) % 15);
  const clockSec = (seed % 50).toString().padStart(2, "0");

  let result: Play["result"];
  if (isScore) result = "touchdown";
  else if (isTurnover) result = "turnover";
  else if (isSpecial && /punt/i.test(visionHint)) result = "punt";
  else if (isSpecial && /field/i.test(visionHint)) result = seed % 2 === 0 ? "fg_good" : "fg_miss";
  else if (yardsGained < 0) result = "loss";
  else if (yardsGained === 0 && side === "offense" && seed % 5 === 0) result = "incomplete";
  else result = "gain";

  const base: Play = {
    id: `${filmId}_p${index}`,
    filmId,
    index,
    startSec,
    endSec,
    quarter,
    clock: `${clockMin}:${clockSec}`,
    down: isSpecial ? undefined : down,
    distance: isSpecial ? undefined : distance,
    yardLine,
    hash: pick(seed, ["L", "M", "R"]),
    side,
    result,
    yardsGained: isSpecial ? undefined : yardsGained,
    tags: [],
    notes: undefined,
  };

  const signal: RawPlaySignal = {
    side,
    down: base.down,
    distance: base.distance,
    yardLine,
    yardsGained: base.yardsGained,
    visionHint,
    isExplosive,
    isScore,
    isTurnover,
    isSpecial,
  };

  if (filmId === "film_7" || filmId === "film_8") {
    if (index % 3 !== 0) return base;
  }

  return applyAiToPlay(base, signal);
}

export function seedPlaysForFilm(film: Film): Play[] {
  const plays: Play[] = [];
  const count = film.playCount;
  const usable = Math.max(film.durationSec - 60, count * 12);
  const slot = usable / count;
  for (let i = 0; i < count; i++) {
    const startSec = Math.round(20 + i * slot);
    const clip = 7 + (hash(`${film.id}:${i}`) % 6);
    const endSec = Math.min(film.durationSec - 5, startSec + clip);
    plays.push(buildPlay(film.id, i + 1, startSec, endSec));
  }
  return plays;
}

export function withTagCounts(films: Film[], playsByFilm: Record<string, Play[]>): Film[] {
  return films.map((f) => {
    const plays = playsByFilm[f.id] ?? [];
    const tagCount = plays.reduce((n, p) => n + p.tags.length, 0);
    return { ...f, tagCount, playCount: plays.length || f.playCount };
  });
}
