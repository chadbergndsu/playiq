/**
 * Open editorial exports for NLE / FFmpeg workflows.
 *
 * - FFmpeg concat demuxer list (most portable for open tools)
 * - Simplified CMX-style EDL comments (readable in text editors)
 *
 * Competitors push you into proprietary playlists; these open lists work with
 * FFmpeg, DaVinci Resolve (import), and shell pipelines.
 */

import type { Play } from "./types";

export type ClipSource = {
  play: Play;
  /** Path or URL placeholder for the source media file */
  mediaPath: string;
};

function secToEdlTime(sec: number, fps = 30): string {
  const s = Math.max(0, sec);
  const totalFrames = Math.round(s * fps);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

/**
 * FFmpeg concat demuxer script.
 * Use: ffmpeg -f concat -safe 0 -i cutup.txt -c copy out.mp4
 * (requires re-encoding if in/out points need accurate trim — see filter variant)
 */
export function playsToFfmpegConcatList(
  clips: ClipSource[],
  opts: { reencodeHint?: boolean } = {},
): string {
  const lines: string[] = [];
  lines.push("# PlayIQ open cutup — FFmpeg concat demuxer");
  lines.push("# ffmpeg -f concat -safe 0 -i this_file.txt -c copy out.mp4");
  if (opts.reencodeHint) {
    lines.push(
      "# For frame-accurate in/out prefer filter_complex trim+concat (see docs).",
    );
  }
  lines.push("");
  for (const { play, mediaPath } of clips) {
    const dur = Math.max(0.1, play.endSec - play.startSec);
    lines.push(`# Play ${play.index} ${play.side} ${play.tags.map((t) => t.label).join(",")}`);
    lines.push(`file '${mediaPath.replace(/'/g, "'\\''")}'`);
    lines.push(`inpoint ${play.startSec.toFixed(3)}`);
    lines.push(`outpoint ${(play.startSec + dur).toFixed(3)}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Human-readable edit decision list (not byte-identical CMX3600, but open and useful).
 */
export function playsToSimpleEdl(
  clips: ClipSource[],
  opts: { title?: string; fps?: number } = {},
): string {
  const fps = opts.fps ?? 30;
  const lines: string[] = [
    `TITLE: ${opts.title ?? "PlayIQ Cutup"}`,
    `FCM: NON-DROP FRAME`,
    `* GENERATOR: PlayIQ open EDL`,
    `* FPS: ${fps}`,
    "",
  ];
  let recIn = 0;
  clips.forEach((c, i) => {
    const dur = Math.max(0.1, c.play.endSec - c.play.startSec);
    const srcIn = secToEdlTime(c.play.startSec, fps);
    const srcOut = secToEdlTime(c.play.endSec, fps);
    const recInT = secToEdlTime(recIn, fps);
    const recOutT = secToEdlTime(recIn + dur, fps);
    const event = (i + 1).toString().padStart(3, "0");
    lines.push(
      `${event}  AX       V     C        ${srcIn} ${srcOut} ${recInT} ${recOutT}`,
    );
    lines.push(`* FROM CLIP NAME: ${c.mediaPath}`);
    lines.push(
      `* PLAY ${c.play.index} ${c.play.side} ${c.play.tags.map((t) => t.label).join(" / ")}`,
    );
    lines.push("");
    recIn += dur;
  });
  return lines.join("\n");
}

/** Shell-friendly filter graph sketch for accurate trims (documentation export). */
export function playsToFfmpegFilterComplex(
  clips: ClipSource[],
  outputName = "out.mp4",
): string {
  if (clips.length === 0) return "# no clips\n";
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# PlayIQ open FFmpeg filter_complex cutup (re-encode)",
    "set -euo pipefail",
    "",
  ];
  const inputs = clips
    .map((c) => `-i ${JSON.stringify(c.mediaPath)}`)
    .join(" ");
  const filters = clips
    .map((c, i) => {
      const d = Math.max(0.1, c.play.endSec - c.play.startSec).toFixed(3);
      return `[${i}:v]trim=start=${c.play.startSec.toFixed(3)}:duration=${d},setpts=PTS-STARTPTS[v${i}];[${i}:a]atrim=start=${c.play.startSec.toFixed(3)}:duration=${d},asetpts=PTS-STARTPTS[a${i}]`;
    })
    .join(";\n");
  const concatIn = clips.map((_, i) => `[v${i}][a${i}]`).join("");
  lines.push(
    `ffmpeg ${inputs} -filter_complex "\\\n${filters};\\\n${concatIn}concat=n=${clips.length}:v=1:a=1[outv][outa]" \\\n  -map "[outv]" -map "[outa]" ${JSON.stringify(outputName)}`,
  );
  lines.push("");
  return lines.join("\n");
}
