/**
 * Open Film Package (OFP) — portable, open JSON for coach film exchange.
 *
 * Unlike proprietary Hudl/Sportscode packages, OFP is plain JSON you own:
 * films, plays, tags, cutups, and optional ontology IDs. Import/export without
 * a vendor lock-in.
 */

import { ONTOLOGY_VERSION, mapPlayTagsToOntology } from "./ontology";
import type { Cutup, Film, Play, PlayTag } from "./types";

export const OFP_VERSION = "1.0.0" as const;
export const OFP_MEDIA_TYPE = "application/vnd.playiq.ofp+json";

export type OfpTag = {
  category: PlayTag["category"];
  label: string;
  source: PlayTag["source"];
  confidence?: number;
  /** Resolved Open Play Ontology id when known */
  ontologyId?: string;
};

export type OfpPlay = {
  id: string;
  filmId: string;
  index: number;
  startSec: number;
  endSec: number;
  quarter: 1 | 2 | 3 | 4;
  clock: string;
  down?: Play["down"];
  distance?: number;
  yardLine?: number;
  hash?: Play["hash"];
  side: Play["side"];
  result?: Play["result"];
  yardsGained?: number;
  notes?: string;
  starred?: boolean;
  tags: OfpTag[];
};

export type OfpFilm = {
  id: string;
  title: string;
  opponent: string;
  week: number;
  season: string;
  date: string;
  venue: Film["venue"];
  level: Film["level"];
  durationSec: number;
  status: Film["status"];
  sourceFileName?: string;
};

export type OfpCutup = {
  id: string;
  title: string;
  description: string;
  playIds: string[];
  filterSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenFilmPackage = {
  format: "playiq.open-film-package";
  version: typeof OFP_VERSION;
  ontologyVersion: typeof ONTOLOGY_VERSION;
  exportedAt: string;
  generator: string;
  films: OfpFilm[];
  plays: OfpPlay[];
  cutups: OfpCutup[];
};

export function playToOfp(play: Play): OfpPlay {
  return {
    id: play.id,
    filmId: play.filmId,
    index: play.index,
    startSec: play.startSec,
    endSec: play.endSec,
    quarter: play.quarter,
    clock: play.clock,
    down: play.down,
    distance: play.distance,
    yardLine: play.yardLine,
    hash: play.hash,
    side: play.side,
    result: play.result,
    yardsGained: play.yardsGained,
    notes: play.notes,
    starred: play.starred,
    tags: play.tags.map((t) => {
      const ont = mapPlayTagsToOntology([t])[0];
      return {
        category: t.category,
        label: t.label,
        source: t.source,
        confidence: t.confidence,
        ontologyId: ont?.entry.id,
      };
    }),
  };
}

export function buildOpenFilmPackage(input: {
  films: Film[];
  plays: Play[];
  cutups?: Cutup[];
  now?: Date;
  generator?: string;
}): OpenFilmPackage {
  return {
    format: "playiq.open-film-package",
    version: OFP_VERSION,
    ontologyVersion: ONTOLOGY_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    generator: input.generator ?? "PlayIQ",
    films: input.films.map((f) => ({
      id: f.id,
      title: f.title,
      opponent: f.opponent,
      week: f.week,
      season: f.season,
      date: f.date,
      venue: f.venue,
      level: f.level,
      durationSec: f.durationSec,
      status: f.status,
      sourceFileName: f.sourceFileName,
    })),
    plays: input.plays.map(playToOfp),
    cutups: (input.cutups ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      playIds: [...c.playIds],
      filterSummary: c.filterSummary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

export function serializeOfp(pkg: OpenFilmPackage): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function parseOfp(raw: string): OpenFilmPackage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("OFP is not valid JSON");
  }
  if (!data || typeof data !== "object") throw new Error("OFP must be an object");
  const o = data as Record<string, unknown>;
  if (o.format !== "playiq.open-film-package") {
    throw new Error("Not an Open Film Package (missing format marker)");
  }
  if (typeof o.version !== "string") throw new Error("OFP missing version");
  if (!Array.isArray(o.films) || !Array.isArray(o.plays)) {
    throw new Error("OFP requires films[] and plays[]");
  }
  return data as OpenFilmPackage;
}

/**
 * Merge imported OFP plays/films into existing state (by id, import wins on collision
 * for film metadata; plays replace per filmId when film is in package).
 */
export function mergeOfpIntoLibrary(
  current: { films: Film[]; playsByFilm: Record<string, Play[]> },
  pkg: OpenFilmPackage,
  now = new Date(),
): { films: Film[]; playsByFilm: Record<string, Play[]>; importedFilms: number; importedPlays: number } {
  const filmsById = new Map(current.films.map((f) => [f.id, f]));
  const playsByFilm = { ...current.playsByFilm };

  for (const f of pkg.films) {
    const existing = filmsById.get(f.id);
    filmsById.set(f.id, {
      id: f.id,
      title: f.title,
      opponent: f.opponent,
      week: f.week,
      season: f.season,
      date: f.date,
      venue: f.venue,
      level: f.level,
      durationSec: f.durationSec,
      status: f.status,
      aiProgress: f.status === "ready" ? 100 : existing?.aiProgress ?? 50,
      playCount: existing?.playCount ?? 0,
      tagCount: existing?.tagCount ?? 0,
      thumbnailHue: existing?.thumbnailHue ?? 210,
      createdAt: existing?.createdAt ?? now.toISOString(),
      sourceFileName: f.sourceFileName ?? existing?.sourceFileName,
      isUpload: existing?.isUpload,
    });
  }

  const playsByFilmId = new Map<string, Play[]>();
  for (const p of pkg.plays) {
    const list = playsByFilmId.get(p.filmId) ?? [];
    list.push({
      id: p.id,
      filmId: p.filmId,
      index: p.index,
      startSec: p.startSec,
      endSec: p.endSec,
      quarter: p.quarter,
      clock: p.clock,
      down: p.down,
      distance: p.distance,
      yardLine: p.yardLine,
      hash: p.hash,
      side: p.side,
      result: p.result,
      yardsGained: p.yardsGained,
      notes: p.notes,
      starred: p.starred,
      tags: p.tags.map((t, i) => ({
        id: `import:${p.id}:${i}:${t.label}`,
        category: t.category,
        label: t.label,
        source: t.source === "coach" || t.source === "ai" ? t.source : "import",
        confidence: t.confidence,
      })),
    });
    playsByFilmId.set(p.filmId, list);
  }

  for (const [filmId, plays] of playsByFilmId) {
    playsByFilm[filmId] = plays.sort((a, b) => a.index - b.index);
    const film = filmsById.get(filmId);
    if (film) {
      const tagCount = plays.reduce((n, pl) => n + pl.tags.length, 0);
      filmsById.set(filmId, {
        ...film,
        playCount: plays.length,
        tagCount,
      });
    }
  }

  return {
    films: Array.from(filmsById.values()).sort((a, b) => a.week - b.week),
    playsByFilm,
    importedFilms: pkg.films.length,
    importedPlays: pkg.plays.length,
  };
}
