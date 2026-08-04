/**
 * AI tagging heuristics — pure, unit-tested.
 * Models a first-pass film analysis that coaches refine.
 */

import type { Play, PlayTag, Side, TagCategory } from "./types";

export type RawPlaySignal = {
  side: Side;
  down?: 1 | 2 | 3 | 4;
  distance?: number;
  yardLine?: number;
  yardsGained?: number;
  /** Free-text model hint from vision pipeline (demo: seeded) */
  visionHint?: string;
  isExplosive?: boolean;
  isScore?: boolean;
  isTurnover?: boolean;
  isSpecial?: boolean;
};

const FORMATION_HINTS: Array<{ match: RegExp; label: string }> = [
  { match: /shotgun|empty/i, label: "Shotgun" },
  { match: /under.?center|i-form|pro/i, label: "Under center" },
  { match: /pistol/i, label: "Pistol" },
  { match: /goal.?line|heavy/i, label: "Goal line" },
  { match: /trips|3x1/i, label: "Trips" },
  { match: /bunch|stack/i, label: "Bunch" },
];

const CONCEPT_HINTS: Array<{ match: RegExp; label: string; side?: Side }> = [
  { match: /inside.?zone|iz/i, label: "Inside zone", side: "offense" },
  { match: /outside.?zone|oz|stretch/i, label: "Outside zone", side: "offense" },
  { match: /power|gap/i, label: "Power", side: "offense" },
  { match: /counter/i, label: "Counter", side: "offense" },
  { match: /screen/i, label: "Screen", side: "offense" },
  { match: /slant|stick|mesh/i, label: "Quick game", side: "offense" },
  { match: /four.?vert|go.?ball|vertical/i, label: "Four verticals", side: "offense" },
  { match: /flood|smash|levels/i, label: "Flood concept", side: "offense" },
  { match: /boot|nak|waggle/i, label: "Boot / waggle", side: "offense" },
  { match: /rpo|glance/i, label: "RPO", side: "offense" },
  { match: /blitz|pressure/i, label: "Pressure", side: "defense" },
  { match: /cover.?3|cover3/i, label: "Cover 3", side: "defense" },
  { match: /cover.?2|tampa/i, label: "Cover 2", side: "defense" },
  { match: /man|press/i, label: "Man coverage", side: "defense" },
  { match: /punt/i, label: "Punt", side: "special" },
  { match: /field.?goal|fg/i, label: "Field goal", side: "special" },
];

function tagId(category: TagCategory, label: string, source: string): string {
  return `${source}:${category}:${label.toLowerCase().replace(/\s+/g, "_")}`;
}

function makeTag(
  category: TagCategory,
  label: string,
  confidence: number,
  source: PlayTag["source"] = "ai",
): PlayTag {
  return {
    id: tagId(category, label, source),
    category,
    label,
    source,
    confidence: source === "ai" ? Math.round(confidence * 100) / 100 : undefined,
  };
}

function situationTags(signal: RawPlaySignal): PlayTag[] {
  const tags: PlayTag[] = [];
  if (signal.down === 3 && (signal.distance ?? 0) >= 7) {
    tags.push(makeTag("situation", "3rd & long", 0.92));
  }
  if (signal.down === 3 && (signal.distance ?? 99) <= 3) {
    tags.push(makeTag("situation", "3rd & short", 0.9));
  }
  if (signal.down === 4) {
    tags.push(makeTag("situation", "4th down", 0.95));
  }
  if ((signal.yardLine ?? 50) <= 20) {
    tags.push(makeTag("situation", "Red zone", 0.88));
  }
  if ((signal.yardLine ?? 0) >= 80) {
    tags.push(makeTag("situation", "Goal-to-go territory", 0.85));
  }
  return tags;
}

function resultTags(signal: RawPlaySignal): PlayTag[] {
  const tags: PlayTag[] = [];
  const y = signal.yardsGained ?? 0;
  if (signal.isScore) tags.push(makeTag("result", "Touchdown", 0.97));
  if (signal.isTurnover) tags.push(makeTag("result", "Turnover", 0.94));
  if (signal.isExplosive || y >= 15) tags.push(makeTag("result", "Explosive", 0.86));
  if (y < 0) tags.push(makeTag("result", "TFL / loss", 0.83));
  if (y === 0 && signal.side === "offense" && !signal.isSpecial) {
    tags.push(makeTag("result", "No gain", 0.7));
  }
  return tags;
}

function personnelGuess(signal: RawPlaySignal): PlayTag[] {
  const hint = signal.visionHint ?? "";
  if (/11 personnel|1rb.?1te|3 wr/i.test(hint)) {
    return [makeTag("personnel", "11 personnel", 0.78)];
  }
  if (/12 personnel|2 te/i.test(hint)) {
    return [makeTag("personnel", "12 personnel", 0.76)];
  }
  if (/21 personnel|2 back/i.test(hint)) {
    return [makeTag("personnel", "21 personnel", 0.74)];
  }
  if (signal.side === "offense") {
    return [makeTag("personnel", "11 personnel", 0.55)];
  }
  return [];
}

/**
 * Produce AI tags from vision/metadata signals for one play.
 */
export function generateAiTags(signal: RawPlaySignal): PlayTag[] {
  const tags: PlayTag[] = [];
  const hint = signal.visionHint ?? "";

  if (signal.isSpecial || signal.side === "special") {
    tags.push(makeTag("formation", "Special teams", 0.9));
  }

  for (const f of FORMATION_HINTS) {
    if (f.match.test(hint)) {
      tags.push(makeTag("formation", f.label, 0.82));
      break;
    }
  }

  for (const c of CONCEPT_HINTS) {
    if (c.side && c.side !== signal.side && signal.side !== "special") continue;
    if (c.match.test(hint)) {
      tags.push(makeTag("concept", c.label, 0.8));
      break;
    }
  }

  // Fallback concepts when vision is sparse
  if (!tags.some((t) => t.category === "concept")) {
    if (signal.side === "offense") {
      const y = signal.yardsGained ?? 0;
      if ((signal.distance ?? 10) <= 2 && (signal.down === 3 || signal.down === 4)) {
        tags.push(makeTag("concept", "Short yardage", 0.62));
      } else if (y >= 8) {
        tags.push(makeTag("concept", "Pass concept (est.)", 0.48));
      } else {
        tags.push(makeTag("concept", "Run concept (est.)", 0.48));
      }
    } else if (signal.side === "defense") {
      tags.push(makeTag("concept", "Base defense (est.)", 0.45));
    }
  }

  if (!tags.some((t) => t.category === "formation") && signal.side === "offense") {
    tags.push(makeTag("formation", "Shotgun", 0.5));
  }

  tags.push(...personnelGuess(signal));
  tags.push(...situationTags(signal));
  tags.push(...resultTags(signal));

  // Dedupe by id
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Merge AI tags into a play without clobbering coach tags.
 * Coach tags win on same label; AI fills gaps.
 */
export function mergeTags(existing: PlayTag[], aiTags: PlayTag[]): PlayTag[] {
  const byLabel = new Map<string, PlayTag>();
  for (const t of existing) {
    byLabel.set(t.label.toLowerCase(), t);
  }
  for (const t of aiTags) {
    const key = t.label.toLowerCase();
    const cur = byLabel.get(key);
    if (!cur) {
      byLabel.set(key, t);
    } else if (cur.source === "ai" && t.source === "ai") {
      // Keep higher confidence
      if ((t.confidence ?? 0) > (cur.confidence ?? 0)) byLabel.set(key, t);
    }
    // coach / import always kept as-is
  }
  return Array.from(byLabel.values());
}

export function applyAiToPlay(play: Play, signal: RawPlaySignal): Play {
  const aiTags = generateAiTags({
    ...signal,
    side: signal.side ?? play.side,
    down: signal.down ?? play.down,
    distance: signal.distance ?? play.distance,
    yardLine: signal.yardLine ?? play.yardLine,
    yardsGained: signal.yardsGained ?? play.yardsGained,
  });
  return {
    ...play,
    tags: mergeTags(play.tags, aiTags),
  };
}

export function confidenceBand(c: number | undefined): "high" | "medium" | "low" | "n/a" {
  if (c === undefined) return "n/a";
  if (c >= 0.8) return "high";
  if (c >= 0.6) return "medium";
  return "low";
}

export function countAiTags(plays: Play[]): number {
  return plays.reduce(
    (n, p) => n + p.tags.filter((t) => t.source === "ai").length,
    0,
  );
}

export function averageAiConfidence(plays: Play[]): number | null {
  const confs = plays.flatMap((p) =>
    p.tags.filter((t) => t.source === "ai" && t.confidence !== undefined).map((t) => t.confidence!),
  );
  if (confs.length === 0) return null;
  return Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 100) / 100;
}
