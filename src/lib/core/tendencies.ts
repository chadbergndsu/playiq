/**
 * Tendency reports from tagged film — pure analytics for Insights.
 * Market comps (Hudl Assist / Sportscode) surface formation × situation counts.
 */

import type { Down, Play, Side } from "./types";

export type LabelCount = { label: string; count: number };

export type DownDistanceBucket = {
  down: Down | "all";
  distanceBand: "short" | "medium" | "long" | "all";
  count: number;
  avgYards: number | null;
};

function distanceBand(d: number | undefined): "short" | "medium" | "long" {
  if (d == null || d <= 3) return "short";
  if (d <= 6) return "medium";
  return "long";
}

export function countByTagCategory(
  plays: Play[],
  category: "formation" | "concept" | "personnel" | "situation",
  limit = 10,
): LabelCount[] {
  const map = new Map<string, number>();
  for (const p of plays) {
    for (const t of p.tags) {
      if (t.category !== category) continue;
      map.set(t.label, (map.get(t.label) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Offense 3rd-down success proxy: gain >= distance on 3rd down. */
export function thirdDownConversion(plays: Play[]): {
  attempts: number;
  conversions: number;
  rate: number | null;
} {
  const thirds = plays.filter((p) => p.side === "offense" && p.down === 3);
  const conversions = thirds.filter(
    (p) => (p.yardsGained ?? 0) >= (p.distance ?? 99),
  ).length;
  const attempts = thirds.length;
  return {
    attempts,
    conversions,
    rate: attempts === 0 ? null : Math.round((conversions / attempts) * 1000) / 10,
  };
}

export function downDistanceMatrix(
  plays: Play[],
  side: Side | "all" = "offense",
): DownDistanceBucket[] {
  const filtered = plays.filter((p) => (side === "all" ? true : p.side === side));
  const buckets = new Map<string, { count: number; yards: number }>();

  for (const p of filtered) {
    if (p.down == null) continue;
    const band = distanceBand(p.distance);
    const key = `${p.down}:${band}`;
    const cur = buckets.get(key) ?? { count: 0, yards: 0 };
    cur.count += 1;
    cur.yards += p.yardsGained ?? 0;
    buckets.set(key, cur);
  }

  const out: DownDistanceBucket[] = [];
  for (const down of [1, 2, 3, 4] as Down[]) {
    for (const band of ["short", "medium", "long"] as const) {
      const cur = buckets.get(`${down}:${band}`);
      if (!cur) continue;
      out.push({
        down,
        distanceBand: band,
        count: cur.count,
        avgYards:
          cur.count === 0
            ? null
            : Math.round((cur.yards / cur.count) * 10) / 10,
      });
    }
  }
  return out;
}

export function explosiveRate(plays: Play[]): {
  total: number;
  explosive: number;
  rate: number | null;
} {
  const offense = plays.filter((p) => p.side === "offense");
  const explosive = offense.filter(
    (p) =>
      (p.yardsGained ?? 0) >= 15 ||
      p.tags.some((t) => t.label.toLowerCase() === "explosive"),
  ).length;
  return {
    total: offense.length,
    explosive,
    rate:
      offense.length === 0
        ? null
        : Math.round((explosive / offense.length) * 1000) / 10,
  };
}
