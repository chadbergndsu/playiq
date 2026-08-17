/** PlayIQ domain types — framework-free. */

export type Side = "offense" | "defense" | "special";
export type Down = 1 | 2 | 3 | 4;
export type TagCategory =
  | "formation"
  | "concept"
  | "result"
  | "personnel"
  | "situation"
  | "coach_note";
export type TagSource = "coach" | "ai" | "import";
export type FilmStatus = "processing" | "ready" | "needs_review";
export type Venue = "home" | "away" | "neutral";
export type Level = "varsity" | "jv" | "freshman" | "youth" | "college";
export type PlayResult =
  | "gain"
  | "loss"
  | "incomplete"
  | "touchdown"
  | "turnover"
  | "punt"
  | "fg_good"
  | "fg_miss"
  | "penalty"
  | "no_play";

export type PlayTag = {
  id: string;
  category: TagCategory;
  label: string;
  source: TagSource;
  /** 0–1 when source is AI */
  confidence?: number;
};

export type Play = {
  id: string;
  filmId: string;
  index: number;
  startSec: number;
  endSec: number;
  quarter: 1 | 2 | 3 | 4;
  clock: string;
  down?: Down;
  distance?: number;
  /** Field position 1–99 (own territory low) */
  yardLine?: number;
  hash?: "L" | "M" | "R";
  side: Side;
  result?: PlayResult;
  yardsGained?: number;
  tags: PlayTag[];
  notes?: string;
  /** Coach bookmark for install / teach reels */
  starred?: boolean;
};

export type Film = {
  id: string;
  title: string;
  opponent: string;
  week: number;
  season: string;
  date: string;
  venue: Venue;
  level: Level;
  durationSec: number;
  status: FilmStatus;
  /** 0–100 AI analysis progress */
  aiProgress: number;
  playCount: number;
  tagCount: number;
  /** Deterministic hue for thumbnail wash */
  thumbnailHue: number;
  createdAt: string;
  /** Optional local object URL / name from coach upload (demo) */
  sourceFileName?: string;
  /** True when created via Upload film path */
  isUpload?: boolean;
  /** Bundled / hosted clip URL (public path) when no IndexedDB blob */
  sourceUrl?: string;
  /** Optional poster image for library cards */
  posterUrl?: string;
  /** Phone / endzone / sideline portrait clips */
  orientation?: "portrait" | "landscape";
};

export type Cutup = {
  id: string;
  title: string;
  description: string;
  playIds: string[];
  filterSummary: string;
  createdAt: string;
  updatedAt: string;
  /** Public share token when published */
  shareToken?: string;
};

export type LibraryFilter = {
  query: string;
  status: FilmStatus | "all";
  season: string | "all";
};

export type PlayFilter = {
  query: string;
  side: Side | "all";
  concept: string | "all";
  down: Down | "all";
  source: TagSource | "all";
  /** When true, only starred plays */
  starredOnly?: boolean;
};

/** Portable cutup payload for share links / export (no secrets). */
export type CutupShareSnapshot = {
  version: 1;
  token: string;
  title: string;
  description: string;
  filterSummary: string;
  createdAt: string;
  plays: Array<{
    id: string;
    filmTitle: string;
    opponent: string;
    index: number;
    side: Side;
    down?: Down;
    distance?: number;
    yardLine?: number;
    clock: string;
    quarter: 1 | 2 | 3 | 4;
    yardsGained?: number;
    result?: PlayResult;
    tags: Array<{ category: TagCategory; label: string; source: TagSource }>;
    notes?: string;
    startSec: number;
    endSec: number;
  }>;
};
