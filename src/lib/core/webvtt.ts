/**
 * WebVTT chapter / metadata tracks from film plays — W3C open standard.
 *
 * Hudl-style tools rarely emit portable chapter tracks. Any HTML5 player,
 * VLC, OBS, or YouTube workflow can load a .vtt next to game film.
 * @see https://www.w3.org/TR/webvtt1/
 */

import type { Play } from "./types";

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
