/**
 * Cutup export helpers — pure, unit-tested.
 * Coaches export teach reels for offline review (CSV / JSON).
 */

import type { Cutup, CutupShareSnapshot, Film, Play } from "./types";

/** Neutralize spreadsheet formula injection; then quote if needed. */
function csvEscape(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildCutupShareSnapshot(input: {
  token: string;
  cutup: Cutup;
  plays: Play[];
  films: Film[];
  now?: Date;
}): CutupShareSnapshot {
  const filmMap = new Map(input.films.map((f) => [f.id, f]));
  const order = new Map(input.cutup.playIds.map((id, i) => [id, i]));
  const plays = input.plays
    .filter((p) => order.has(p.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((p) => {
      const film = filmMap.get(p.filmId);
      return {
        id: p.id,
        filmTitle: film?.title ?? p.filmId,
        opponent: film?.opponent ?? "",
        index: p.index,
        side: p.side,
        down: p.down,
        distance: p.distance,
        yardLine: p.yardLine,
        clock: p.clock,
        quarter: p.quarter,
        yardsGained: p.yardsGained,
        result: p.result,
        tags: p.tags.map((t) => ({
          category: t.category,
          label: t.label,
          source: t.source,
        })),
        notes: p.notes,
        startSec: p.startSec,
        endSec: p.endSec,
      };
    });

  return {
    version: 1,
    token: input.token,
    title: input.cutup.title,
    description: input.cutup.description,
    filterSummary: input.cutup.filterSummary,
    createdAt: (input.now ?? new Date()).toISOString(),
    plays,
  };
}

/** JSON string for download or API body. */
export function exportCutupJson(snapshot: CutupShareSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Spreadsheet-friendly cutup for coaches (Excel / Sheets). */
export function exportCutupCsv(snapshot: CutupShareSnapshot): string {
  const headers = [
    "play_index",
    "film",
    "opponent",
    "side",
    "down",
    "distance",
    "yard_line",
    "quarter",
    "clock",
    "yards_gained",
    "result",
    "concepts",
    "formations",
    "tags",
    "notes",
    "clip_start_sec",
    "clip_end_sec",
  ];
  const rows = snapshot.plays.map((p) => {
    const concepts = p.tags
      .filter((t) => t.category === "concept")
      .map((t) => t.label)
      .join("; ");
    const formations = p.tags
      .filter((t) => t.category === "formation")
      .map((t) => t.label)
      .join("; ");
    const tags = p.tags.map((t) => t.label).join("; ");
    return [
      String(p.index),
      p.filmTitle,
      p.opponent,
      p.side,
      p.down != null ? String(p.down) : "",
      p.distance != null ? String(p.distance) : "",
      p.yardLine != null ? String(p.yardLine) : "",
      String(p.quarter),
      p.clock,
      p.yardsGained != null ? String(p.yardsGained) : "",
      p.result ?? "",
      concepts,
      formations,
      tags,
      p.notes ?? "",
      String(p.startSec),
      String(p.endSec),
    ].map(csvEscape);
  });
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n";
}

/**
 * CSPRNG share token (browser + Node). Prefer server-minted tokens on publish;
 * client uses this only as a local placeholder before first successful publish.
 */
export function newShareToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      : Buffer.from(bytes).toString("base64url").replace(/=+$/, "");
  return `sh_${b64}`;
}
