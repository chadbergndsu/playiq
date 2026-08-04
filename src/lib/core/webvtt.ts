/**
 * WebVTT chapter / metadata tracks from film plays — W3C open standard.
 *
 * Hudl-style tools rarely emit portable chapter tracks. Any HTML5 player,
 * VLC, OBS, or YouTube workflow can load a .vtt next to game film.
 * Round-trip: export chapters ↔ import back into PlayIQ plays.
 * @see https://www.w3.org/TR/webvtt1/
 */

import type { Down, Play, Side } from "./types";

function pad2(n: number): string {
  return Math.floor(n).toString().padStart(2, "0");
}

/** WebVTT timestamp: HH:MM:SS.mmm */
export function secToWebVttTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const whole = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(whole)}.${ms.toString().padStart(3, "0")}`;
}

function cueText(play: Play): string {
  const concept =
    play.tags.find((t) => t.category === "concept")?.label ??
    play.tags.find((t) => t.category === "formation")?.label ??
    play.side;
  const down =
    play.down != null ? `${play.down}&${play.distance ?? "?"}` : play.side;
  const yards =
    play.yardsGained != null
      ? ` ${play.yardsGained >= 0 ? "+" : ""}${play.yardsGained}`
      : "";
  const star = play.starred ? " ★" : "";
  return `Play ${play.index} · ${down} · ${concept}${yards}${star}`;
}

/**
 * Chapters track: one cue per play (navigable in supporting players).
 */
export function playsToWebVttChapters(
  plays: Play[],
  opts: { title?: string } = {},
): string {
  const sorted = [...plays].sort((a, b) => a.startSec - b.startSec);
  const lines = ["WEBVTT"];
  if (opts.title) {
    lines.push("");
    lines.push(`NOTE ${opts.title}`);
  }
  lines.push("");

  sorted.forEach((p, i) => {
    const end = Math.max(p.endSec, p.startSec + 0.5);
    lines.push(String(i + 1));
    lines.push(`${secToWebVttTime(p.startSec)} --> ${secToWebVttTime(end)}`);
    lines.push(cueText(p));
    if (p.notes?.trim()) lines.push(p.notes.trim().slice(0, 120));
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Metadata track with JSON payload per cue (for tooling / future players).
 */
export function playsToWebVttMetadata(plays: Play[]): string {
  const sorted = [...plays].sort((a, b) => a.startSec - b.startSec);
  const lines = ["WEBVTT", "", "NOTE PlayIQ open metadata track", ""];
  sorted.forEach((p, i) => {
    const end = Math.max(p.endSec, p.startSec + 0.5);
    const payload = {
      playId: p.id,
      index: p.index,
      side: p.side,
      down: p.down,
      distance: p.distance,
      tags: p.tags.map((t) => t.label),
      starred: Boolean(p.starred),
    };
    lines.push(String(i + 1));
    lines.push(`${secToWebVttTime(p.startSec)} --> ${secToWebVttTime(end)}`);
    lines.push(JSON.stringify(payload));
    lines.push("");
  });
  return lines.join("\n");
}

/** Parse WebVTT timestamp to seconds. */
export function webVttTimeToSec(ts: string): number {
  const t = ts.trim().replace(",", ".");
  const parts = t.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Number(m) * 60 + Number(s);
  }
  return Number(t) || 0;
}

export type WebVttCue = {
  startSec: number;
  endSec: number;
  text: string;
  /** Optional JSON body when metadata track */
  json?: Record<string, unknown>;
};

/**
 * Parse a WebVTT file into cues (chapters or metadata).
 * Skips NOTE/STYLE/REGION blocks; tolerant of missing identifiers.
 */
export function parseWebVtt(raw: string): WebVttCue[] {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!/^WEBVTT/i.test(text)) {
    throw new Error("Not a WebVTT file (missing WEBVTT header)");
  }
  const body = text.replace(/^WEBVTT[^\n]*\n?/, "");
  const blocks = body.split(/\n\s*\n+/);
  const cues: WebVttCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split(/\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(lines[0]!)) continue;

    let timingLine = lines[0]!;
    let textStart = 1;
    if (!timingLine.includes("-->") && lines[1]?.includes("-->")) {
      timingLine = lines[1]!;
      textStart = 2;
    }
    if (!timingLine.includes("-->")) continue;

    const [startRaw, endPart] = timingLine.split("-->").map((s) => s.trim());
    if (!startRaw || !endPart) continue;
    const endRaw = endPart.split(/\s+/)[0]!;
    const startSec = webVttTimeToSec(startRaw);
    const endSec = webVttTimeToSec(endRaw);
    if (!(endSec > startSec)) continue;

    const payloadLines = lines.slice(textStart);
    const payload = payloadLines.join("\n").trim();
    let json: Record<string, unknown> | undefined;
    if (payload.startsWith("{")) {
      try {
        json = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        // keep as text
      }
    }
    cues.push({ startSec, endSec, text: payload, json });
  }
  return cues;
}

function parseCueTextToFields(text: string): {
  index?: number;
  side?: Side;
  down?: Down;
  distance?: number;
  concept?: string;
  notes?: string;
  starred?: boolean;
} {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const primary = lines[0] ?? "";
  const notes = lines.slice(1).join(" ").trim() || undefined;
  const starred = /★|\*/.test(primary);

  const playMatch = primary.match(/Play\s+(\d+)/i);
  const index = playMatch ? Number(playMatch[1]) : undefined;

  let side: Side | undefined;
  if (/\boffense\b/i.test(primary)) side = "offense";
  else if (/\bdefense\b/i.test(primary)) side = "defense";
  else if (/\bspecial\b/i.test(primary)) side = "special";

  const downMatch = primary.match(/\b([1-4])\s*&\s*(\d+)\b/);
  const down = downMatch ? (Number(downMatch[1]) as Down) : undefined;
  const distance = downMatch ? Number(downMatch[2]) : undefined;

  const parts = primary.split("·").map((p) => p.trim());
  let concept: string | undefined;
  if (parts.length >= 3) {
    concept = parts[2]!.replace(/[★*]/g, "").replace(/[+-]?\d+\s*$/, "").trim();
  }

  return { index, side, down, distance, concept, notes, starred };
}

/**
 * Convert WebVTT cues into PlayIQ plays for a film.
 * Accepts chapter text cues or PlayIQ metadata JSON cues.
 */
export function webVttCuesToPlays(
  filmId: string,
  cues: WebVttCue[],
  opts: { sourceLabel?: string } = {},
): Play[] {
  return cues.map((cue, i) => {
    if (cue.json && typeof cue.json === "object") {
      const j = cue.json;
      const tags = Array.isArray(j.tags)
        ? (j.tags as unknown[])
            .filter((t): t is string => typeof t === "string")
            .map((label, ti) => ({
              id: `vtt:${filmId}:${i}:${ti}`,
              category: "concept" as const,
              label,
              source: "import" as const,
            }))
        : [];
      return {
        id: typeof j.playId === "string" ? j.playId : `${filmId}_vtt_${i + 1}`,
        filmId,
        index: typeof j.index === "number" ? j.index : i + 1,
        startSec: cue.startSec,
        endSec: cue.endSec,
        quarter: (1 + Math.min(3, Math.floor(i / 15))) as 1 | 2 | 3 | 4,
        clock: "0:00",
        side: (j.side === "defense" || j.side === "special" || j.side === "offense"
          ? j.side
          : "offense") as Side,
        down: (j.down === 1 || j.down === 2 || j.down === 3 || j.down === 4
          ? j.down
          : undefined) as Down | undefined,
        distance: typeof j.distance === "number" ? j.distance : undefined,
        tags,
        starred: Boolean(j.starred),
        notes: opts.sourceLabel ? `Imported from ${opts.sourceLabel}` : undefined,
      } satisfies Play;
    }

    const fields = parseCueTextToFields(cue.text);
    const tags = fields.concept
      ? [
          {
            id: `vtt:${filmId}:${i}:c`,
            category: "concept" as const,
            label: fields.concept,
            source: "import" as const,
          },
        ]
      : [];
    return {
      id: `${filmId}_vtt_${i + 1}`,
      filmId,
      index: fields.index ?? i + 1,
      startSec: cue.startSec,
      endSec: cue.endSec,
      quarter: (1 + Math.min(3, Math.floor(i / 15))) as 1 | 2 | 3 | 4,
      clock: "0:00",
      side: fields.side ?? "offense",
      down: fields.down,
      distance: fields.distance,
      tags,
      starred: fields.starred,
      notes:
        fields.notes ??
        (opts.sourceLabel ? `Imported from ${opts.sourceLabel}` : undefined),
    } satisfies Play;
  });
}

export function importWebVttToPlays(
  filmId: string,
  raw: string,
  opts: { sourceLabel?: string } = {},
): Play[] {
  return webVttCuesToPlays(filmId, parseWebVtt(raw), opts);
}
