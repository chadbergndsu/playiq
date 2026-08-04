/**
 * Cutup builders — pure filters over tagged plays.
 */

import type { Cutup, Play, PlayFilter, Side } from "./types";

export function playMatchesFilter(play: Play, filter: PlayFilter): boolean {
  if (filter.side !== "all" && play.side !== filter.side) return false;
  if (filter.down !== "all" && play.down !== filter.down) return false;

  if (filter.concept !== "all") {
    const hit = play.tags.some(
      (t) =>
        t.category === "concept" &&
        t.label.toLowerCase() === filter.concept.toLowerCase(),
    );
    if (!hit) return false;
  }

  if (filter.source !== "all") {
    const hit = play.tags.some((t) => t.source === filter.source);
    if (!hit) return false;
  }

  if (filter.starredOnly && !play.starred) return false;

  if (filter.query.trim()) {
    const q = filter.query.trim().toLowerCase();
    const hay = [
      play.notes ?? "",
      play.clock,
      play.side,
      play.result ?? "",
      ...play.tags.map((t) => t.label),
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

export function filterPlays(plays: Play[], filter: PlayFilter): Play[] {
  return plays.filter((p) => playMatchesFilter(p, filter));
}

export function summarizeFilter(filter: PlayFilter): string {
  const parts: string[] = [];
  if (filter.side !== "all") parts.push(filter.side);
  if (filter.down !== "all") parts.push(`Down ${filter.down}`);
  if (filter.concept !== "all") parts.push(filter.concept);
  if (filter.source !== "all") parts.push(`${filter.source} tags`);
  if (filter.starredOnly) parts.push("starred");
  if (filter.query.trim()) parts.push(`“${filter.query.trim()}”`);
  return parts.length ? parts.join(" · ") : "All plays";
}

/** Distinct concept labels for filter dropdowns. */
export function listConceptLabels(plays: Play[]): string[] {
  const set = new Set<string>();
  for (const p of plays) {
    for (const t of p.tags) {
      if (t.category === "concept") set.add(t.label);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function buildCutup(input: {
  id: string;
  title: string;
  description?: string;
  plays: Play[];
  filter: PlayFilter;
  now?: Date;
}): Cutup {
  const matched = filterPlays(input.plays, input.filter);
  const ts = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    title: input.title.trim() || "Untitled cutup",
    description: input.description?.trim() ?? "",
    playIds: matched.map((p) => p.id),
    filterSummary: summarizeFilter(input.filter),
    createdAt: ts,
    updatedAt: ts,
  };
}

export function cutupDurationSec(plays: Play[], playIds: string[]): number {
  const set = new Set(playIds);
  return plays
    .filter((p) => set.has(p.id))
    .reduce((sum, p) => sum + Math.max(0, p.endSec - p.startSec), 0);
}

export function groupPlaysBySide(plays: Play[]): Record<Side, number> {
  return {
    offense: plays.filter((p) => p.side === "offense").length,
    defense: plays.filter((p) => p.side === "defense").length,
    special: plays.filter((p) => p.side === "special").length,
  };
}

export function topConcepts(plays: Play[], limit = 5): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const p of plays) {
    for (const t of p.tags) {
      if (t.category !== "concept") continue;
      map.set(t.label, (map.get(t.label) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
