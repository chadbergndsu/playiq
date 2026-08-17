/**
 * Strict share snapshot validation — size + shape caps for public POST.
 */

import type {
  CutupShareSnapshot,
  Down,
  PlayResult,
  Side,
  TagCategory,
  TagSource,
} from "@/lib/core/types";

export const SHARE_MAX_PLAYS = 200;
export const SHARE_MAX_TITLE = 200;
export const SHARE_MAX_DESCRIPTION = 2000;
export const SHARE_MAX_NOTES = 500;
export const SHARE_MAX_LABEL = 80;
export const SHARE_MAX_TAGS_PER_PLAY = 24;
export const SHARE_MAX_PAYLOAD_CHARS = 256_000;

const SIDES = new Set<Side>(["offense", "defense", "special"]);
const DOWNS = new Set<number>([1, 2, 3, 4]);
const CATEGORIES = new Set<TagCategory>([
  "formation",
  "concept",
  "result",
  "personnel",
  "situation",
  "coach_note",
]);
const SOURCES = new Set<TagSource>(["coach", "ai", "import"]);

function clampStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function finiteNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Normalize and validate a share body. Returns null if unusable.
 * Server always assigns `token` after this (caller).
 */
export function normalizeShareSnapshot(
  raw: unknown,
  token: string,
): CutupShareSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.plays) || o.plays.length > SHARE_MAX_PLAYS) return null;

  const title = clampStr(o.title, SHARE_MAX_TITLE).trim();
  if (!title) return null;

  const plays: CutupShareSnapshot["plays"] = [];
  for (const row of o.plays) {
    if (!row || typeof row !== "object") continue;
    const p = row as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id || p.id.length > 128) continue;
    if (!SIDES.has(p.side as Side)) continue;
    const side = p.side as Side;
    const tagsRaw = Array.isArray(p.tags) ? p.tags : [];
    const tags: CutupShareSnapshot["plays"][0]["tags"] = [];
    for (const t of tagsRaw.slice(0, SHARE_MAX_TAGS_PER_PLAY)) {
      if (!t || typeof t !== "object") continue;
      const tr = t as Record<string, unknown>;
      const category = tr.category as TagCategory;
      const source = tr.source as TagSource;
      const label = clampStr(tr.label, SHARE_MAX_LABEL).trim();
      if (!label || !CATEGORIES.has(category) || !SOURCES.has(source)) continue;
      tags.push({ category, label, source });
    }
    const down =
      DOWNS.has(p.down as number) ? (p.down as Down) : undefined;
    const quarter =
      p.quarter === 1 || p.quarter === 2 || p.quarter === 3 || p.quarter === 4
        ? p.quarter
        : 1;
    const startSec = finiteNum(p.startSec) ?? 0;
    const endSec = finiteNum(p.endSec) ?? startSec + 1;
    plays.push({
      id: p.id.slice(0, 128),
      filmTitle: clampStr(p.filmTitle, SHARE_MAX_TITLE) || "Film",
      opponent: clampStr(p.opponent, 120),
      index: typeof p.index === "number" && Number.isFinite(p.index) ? p.index : 0,
      side,
      down,
      distance: finiteNum(p.distance),
      yardLine: finiteNum(p.yardLine),
      clock: clampStr(p.clock, 16) || "0:00",
      quarter,
      yardsGained: finiteNum(p.yardsGained),
      result:
        typeof p.result === "string"
          ? (p.result.slice(0, 32) as PlayResult)
          : undefined,
      tags,
      notes: clampStr(p.notes, SHARE_MAX_NOTES) || undefined,
      startSec,
      endSec: Math.max(endSec, startSec + 0.05),
    });
  }

  if (plays.length === 0) return null;

  const snap: CutupShareSnapshot = {
    version: 1,
    token,
    title,
    description: clampStr(o.description, SHARE_MAX_DESCRIPTION),
    filterSummary: clampStr(o.filterSummary, 400),
    createdAt:
      typeof o.createdAt === "string" && o.createdAt.length < 40
        ? o.createdAt
        : new Date().toISOString(),
    plays,
  };

  const serialized = JSON.stringify(snap);
  if (serialized.length > SHARE_MAX_PAYLOAD_CHARS) return null;
  return snap;
}

/** CSPRNG share token (Node / edge crypto). */
export function mintShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes)
    .toString("base64url")
    .replace(/=+$/, "");
  return `sh_${b64}`;
}
