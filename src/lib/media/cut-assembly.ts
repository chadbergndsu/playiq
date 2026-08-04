/**
 * Client-side cut assembly via Mediabunny + WebCodecs.
 * Trims play segments from a local game file — no server upload.
 */

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import { buildZip } from "@/lib/core/zip";
import { playsToFfmpegConcatList } from "@/lib/core/edl";
import type { Play } from "@/lib/core/types";

export function isWebCodecsAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined"
  );
}

export type MediaProbe = {
  durationSec: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
};

export async function probeMediaBlob(blob: Blob): Promise<MediaProbe> {
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  const durationSec = await input.computeDuration();
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  let width: number | undefined;
  let height: number | undefined;
  if (video) {
    width = await video.getDisplayWidth();
    height = await video.getDisplayHeight();
  }
  return {
    durationSec,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width,
    height,
  };
}

export type TrimSegment = {
  startSec: number;
  endSec: number;
  /** File name inside package */
  name: string;
};

/**
 * Trim one time range from a local media file to MP4 (WebCodecs when available).
 */
export async function trimSegmentToMp4(
  source: Blob,
  segment: { startSec: number; endSec: number },
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const start = Math.max(0, segment.startSec);
  const end = Math.max(start + 0.05, segment.endSec);

  const input = new Input({
    source: new BlobSource(source),
    formats: ALL_FORMATS,
  });
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    tracks: "primary",
    trim: { start, end },
    showWarnings: false,
  });

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks
      .map((t) => t.reason)
      .join("; ");
    throw new Error(
      reasons
        ? `Cannot convert media (${reasons})`
        : "Cannot convert media with current browser codecs",
    );
  }

  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Conversion produced empty buffer");
  return new Blob([buffer], { type: "video/mp4" });
}

export type CutAssemblyResult = {
  /** Single MP4 when only one segment; otherwise null (use zip) */
  singleMp4: Blob | null;
  zip: Blob;
  clipCount: number;
  names: string[];
};

/**
 * Assemble cutup clips from a local game file.
 * One segment → downloadable MP4; many → ZIP of clips + ffmpeg concat list.
 */
export async function assembleCutupFromSource(
  source: Blob,
  plays: Play[],
  opts: {
    title?: string;
    mediaPathHint?: string;
    onProgress?: (done: number, total: number) => void;
    /** Cap clips for demo safety (default 24) */
    maxClips?: number;
  } = {},
): Promise<CutAssemblyResult> {
  const max = opts.maxClips ?? 24;
  const ordered = [...plays]
    .sort((a, b) => a.startSec - b.startSec)
    .slice(0, max);

  if (ordered.length === 0) {
    throw new Error("No plays to assemble");
  }

  const clips: Array<{ name: string; blob: Blob; play: Play }> = [];
  for (let i = 0; i < ordered.length; i++) {
    const play = ordered[i]!;
    const name = `clip_${String(i + 1).padStart(3, "0")}_play${play.index}.mp4`;
    const blob = await trimSegmentToMp4(
      source,
      { startSec: play.startSec, endSec: play.endSec },
      (r) => opts.onProgress?.(i + r, ordered.length),
    );
    clips.push({ name, blob, play });
    opts.onProgress?.(i + 1, ordered.length);
  }

  const mediaPath = opts.mediaPathHint ?? "source.mp4";
  const concat = playsToFfmpegConcatList(
    clips.map((c) => ({ play: c.play, mediaPath: c.name })),
    { reencodeHint: true },
  );
  const readme = [
    `# PlayIQ cutup package`,
    opts.title ? `Title: ${opts.title}` : "",
    `Clips: ${clips.length}`,
    `Source hint: ${mediaPath}`,
    ``,
    `Assembled client-side with Mediabunny (WebCodecs).`,
    `Re-stitch: ffmpeg -f concat -safe 0 -i concat.txt -c copy cutup.mp4`,
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const entries: Array<{ name: string; data: string | Uint8Array }> = [
    { name: "README.txt", data: readme },
    { name: "concat.txt", data: concat },
  ];
  for (const c of clips) {
    entries.push({
      name: c.name,
      data: new Uint8Array(await c.blob.arrayBuffer()),
    });
  }

  const zip = buildZip(entries);
  return {
    singleMp4: clips.length === 1 ? clips[0]!.blob : null,
    zip,
    clipCount: clips.length,
    names: clips.map((c) => c.name),
  };
}
