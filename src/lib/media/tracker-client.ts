import type { TrackingArtifact } from "@/lib/core/tracking";

export const TRACKER_DEFAULT_URL = "http://127.0.0.1:8788";

export type TrackerHealth = {
  ok: boolean;
  model: string;
  device: string;
  ocrAvailable: boolean;
};

function trackerBaseUrl(): string {
  const configured = import.meta.env.VITE_TRACKER_URL as string | undefined;
  return (configured?.trim() || TRACKER_DEFAULT_URL).replace(/\/+$/, "");
}

async function trackerError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    detail?: string;
    error?: string;
  } | null;
  return new Error(body?.detail || body?.error || `Tracker failed (${response.status})`);
}

export async function checkTrackerHealth(signal?: AbortSignal): Promise<TrackerHealth> {
  const response = await fetch(`${trackerBaseUrl()}/health`, { signal });
  if (!response.ok) throw await trackerError(response);
  return (await response.json()) as TrackerHealth;
}

export async function analyzeFilmTracking(input: {
  filmId: string;
  fileName: string;
  video: Blob;
  rosterNumbers: number[];
  analyzedFps?: number;
  startSec: number;
  endSec: number;
  signal?: AbortSignal;
}): Promise<TrackingArtifact> {
  const form = new FormData();
  form.set("film_id", input.filmId);
  form.set("roster_numbers", JSON.stringify(input.rosterNumbers));
  form.set("analyzed_fps", String(input.analyzedFps ?? 5));
  form.set("start_sec", String(input.startSec));
  form.set("end_sec", String(input.endSec));
  form.set("video", input.video, input.fileName);

  let response: Response;
  try {
    response = await fetch(`${trackerBaseUrl()}/analyze`, {
      method: "POST",
      body: form,
      signal: input.signal,
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw error;
    }
    throw new Error(
      `Local tracker is not reachable at ${trackerBaseUrl()}. Run npm run tracker:setup, then npm run tracker.`,
    );
  }
  if (!response.ok) throw await trackerError(response);
  return (await response.json()) as TrackingArtifact;
}
