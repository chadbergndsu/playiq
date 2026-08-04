/**
 * Client-side cut assembly via Mediabunny + WebCodecs.
 * Trims play segments from local game file(s) — no server upload.
 * Preserves input play order (teach reel order).
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

async function withInput<T>(blob: Blob, fn: (input: Input) => Promise<T>): Promise<T> {
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  try {
    return await fn(input);
  } finally {
    // Best-effort dispose if API exposes it
    const anyIn = input as unknown as { dispose?: () => void; destroy?: () => void };
    anyIn.dispose?.();
    anyIn.destroy?.();
  }
}

export async function probeMediaBlob(blob: Blob): Promise<MediaProbe> {
  return withInput(blob, async (input) => {
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
  });
}

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

  try {
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
  } finally {
    const anyIn = input as unknown as { dispose?: () => void; destroy?: () => void };
    anyIn.dispose?.();
    anyIn.destroy?.();
  }
}

export type CutAssemblyResult = {
  singleMp4: Blob | null;
  zip: Blob;
  clipCount: number;
  names: string[];
  omitted: number;
};

/**
 * Assemble cutup clips from a single local game file.
 * Preserves `plays` array order (do not re-sort by startSec).
 */
export async function assembleCutupFromSource(
  source: Blob,
  plays: Play[],
  opts: {
    title?: string;
    mediaPathHint?: string;
    onProgress?: (done: number, total: number) => void;
    maxClips?: number;
  } = {},
): Promise<CutAssemblyResult> {
  const max = opts.maxClips ?? 24;
  const ordered = plays.slice(0, max);
  const omitted = Math.max(0, plays.length - ordered.length);

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

  return packageClips(clips, {
    title: opts.title,
    mediaPath: opts.mediaPathHint ?? "source.mp4",
    omitted,
  });
}

/**
 * Multi-film assemble: resolve media per play.filmId; preserve teach order.
 */
export async function assembleCutupMultiSource(
  plays: Play[],
  mediaByFilmId: Map<string, { blob: Blob; fileName: string }>,
  opts: {
    title?: string;
    onProgress?: (done: number, total: number) => void;
    maxClips?: number;
  } = {},
): Promise<CutAssemblyResult> {
  const max = opts.maxClips ?? 24;
  const ordered = plays.slice(0, max);
  const omitted = Math.max(0, plays.length - ordered.length);

  if (ordered.length === 0) {
    throw new Error("No plays to assemble");
  }

  const missing = ordered.filter((p) => !mediaByFilmId.has(p.filmId));
  if (missing.length === ordered.length) {
    throw new Error("No local media registered for any play in this cutup");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing media for ${missing.length} play(s) (film ${missing[0]!.filmId}). Attach media per film before assembling multi-game reels.`,
    );
  }

  const clips: Array<{ name: string; blob: Blob; play: Play }> = [];
  for (let i = 0; i < ordered.length; i++) {
    const play = ordered[i]!;
    const media = mediaByFilmId.get(play.filmId)!;
    const name = `clip_${String(i + 1).padStart(3, "0")}_play${play.index}.mp4`;
    const blob = await trimSegmentToMp4(
      media.blob,
      { startSec: play.startSec, endSec: play.endSec },
      (r) => opts.onProgress?.(i + r, ordered.length),
    );
    clips.push({ name, blob, play });
    opts.onProgress?.(i + 1, ordered.length);
  }

  return packageClips(clips, {
    title: opts.title,
    mediaPath: "multi-source",
    omitted,
  });
}

async function packageClips(
  clips: Array<{ name: string; blob: Blob; play: Play }>,
  opts: { title?: string; mediaPath: string; omitted: number },
): Promise<CutAssemblyResult> {
  const concat = playsToFfmpegConcatList(
    clips.map((c) => ({ play: c.play, mediaPath: c.name })),
    { reencodeHint: true },
  );
  const readme = [
    `# PlayIQ cutup package`,
    opts.title ? `Title: ${opts.title}` : "",
    `Clips: ${clips.length}${opts.omitted ? ` (${opts.omitted} omitted by maxClips cap)` : ""}`,
    `Source hint: ${opts.mediaPath}`,
    ``,
    `Assembled client-side with Mediabunny (WebCodecs).`,
    `Order matches teach reel (playIds order).`,
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
    omitted: opts.omitted,
  };
}
