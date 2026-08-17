/**
 * Default film library seed — empty school workspace + optional product demo.
 * No real student film or school calendar ships in the public repo.
 */

import { applyAiToPlay } from "./tagging";
import type { RawPlaySignal } from "./tagging";
import {
  TEAM_SCHEDULE,
  type ScheduleGame,
  type ScheduleKind,
} from "./schedule";
import { createAllTrainingFilms, playsForTrainingFilm } from "./training-clip";
import type { Film, Play, Side, Venue } from "./types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(seed: number, arr: T[]): T {
  return arr[seed % arr.length]!;
}

const DEMO_OPPONENTS = [
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

const PLAYABLE_KINDS: ScheduleKind[] = ["home", "away", "neutral", "playoff"];

export function playableScheduleGames(
  schedule: ScheduleGame[] = TEAM_SCHEDULE,
): ScheduleGame[] {
  return schedule.filter((g) => PLAYABLE_KINDS.includes(g.kind));
}

function venueFromKind(kind: ScheduleKind): Venue {
  if (kind === "away") return "away";
  if (kind === "neutral" || kind === "playoff") return "neutral";
  return "home";
}

/** Empty game-week shell — attach phone clips later; no invented plays. */
export function createScheduleShellFilm(
  game: ScheduleGame,
  week: number,
  now = new Date(),
): Film {
  return {
    id: `film_sched_${game.id}`,
    title: `vs ${game.opponent}`,
    opponent: game.opponent,
    week,
    season: "2026",
    date: game.date,
    venue: venueFromKind(game.kind),
    level: "youth",
    durationSec: 0,
    status: "ready",
    aiProgress: 100,
    playCount: 0,
    tagCount: 0,
    thumbnailHue: (hash(game.opponent) % 40) + 200,
    createdAt: now.toISOString(),
  };
}

/** Default seed: empty library unless private deploy adds training clips/schedule. */
export function seedFilms(now = new Date()): Film[] {
  const training = createAllTrainingFilms(now).map((t) => t.film);
  const shells = playableScheduleGames().map((game, i) =>
    createScheduleShellFilm(game, i + 1, now),
  );
  return [...training, ...shells];
}

/** Optional marketing / product demo season (varsity). Not loaded by default. */
export function seedProductDemoFilms(now = new Date()): Film[] {
  const season = "2025";
  return DEMO_OPPONENTS.map((opponent, i) => {
    const id = `film_demo_${i + 1}`;
    const week = i + 1;
    const d = new Date(now);
    d.setDate(d.getDate() - (DEMO_OPPONENTS.length - i) * 7);
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
      level: "varsity" as const,
      durationSec: 5400 + (hash(id) % 900),
      status: status as Film["status"],
      aiProgress: status === "processing" ? 35 + (hash(id) % 40) : 100,
      playCount,
      tagCount: 0,
      thumbnailHue: (hash(opponent) % 40) + 200,
      createdAt: d.toISOString(),
    } satisfies Film;
  });
}

function buildDemoPlay(
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

  if (filmId === "film_demo_7" || filmId === "film_demo_8") {
    if (index % 3 !== 0) return base;
  }

  return applyAiToPlay(base, signal);
}

export function seedPlaysForFilm(film: Film): Play[] {
  const trainingPlays = playsForTrainingFilm(film.id, film.createdAt);
  if (trainingPlays) return trainingPlays;
  if (film.id.startsWith("film_sched_")) return [];
  if (!film.id.startsWith("film_demo_")) return [];
  const plays: Play[] = [];
  const count = film.playCount;
  const usable = Math.max(film.durationSec - 60, count * 12);
  const slot = usable / count;
  for (let i = 0; i < count; i++) {
    const startSec = Math.round(20 + i * slot);
    const clip = 7 + (hash(`${film.id}:${i}`) % 6);
    const endSec = Math.min(film.durationSec - 5, startSec + clip);
    plays.push(buildDemoPlay(film.id, i + 1, startSec, endSec));
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

/** Group films for schedule-aware library UI. */
export type LibraryFilmGroup = {
  id: string;
  label: string;
  sortKey: string;
  films: Film[];
};

export function groupFilmsForLibrary(films: Film[]): LibraryFilmGroup[] {
  const practice = films.filter((f) => f.week === 0 || f.id.startsWith("film_train_"));
  const schedule = films.filter((f) => f.id.startsWith("film_sched_"));
  const uploads = films.filter(
    (f) =>
      !f.id.startsWith("film_train_") &&
      !f.id.startsWith("film_sched_") &&
      !f.id.startsWith("film_demo_"),
  );
  const demos = films.filter((f) => f.id.startsWith("film_demo_"));

  const groups: LibraryFilmGroup[] = [];

  if (practice.length) {
    groups.push({
      id: "practice",
      label: "Practice clips",
      sortKey: "0-practice",
      films: [...practice].sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  const byWeek = new Map<number, Film[]>();
  for (const f of schedule) {
    const list = byWeek.get(f.week) ?? [];
    list.push(f);
    byWeek.set(f.week, list);
  }
  for (const week of [...byWeek.keys()].sort((a, b) => a - b)) {
    const weekFilms = byWeek.get(week)!;
    const first = weekFilms[0]!;
    groups.push({
      id: `week-${week}`,
      label: `Week ${week} · vs ${first.opponent} · ${first.date}`,
      sortKey: `1-week-${String(week).padStart(2, "0")}`,
      films: weekFilms,
    });
  }

  if (uploads.length) {
    groups.push({
      id: "uploads",
      label: "Uploaded clips",
      sortKey: "2-uploads",
      films: [...uploads].sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  if (demos.length) {
    groups.push({
      id: "demo",
      label: "Product demo (varsity)",
      sortKey: "9-demo",
      films: demos,
    });
  }

  return groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
