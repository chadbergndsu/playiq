import { createFileRoute } from "@tanstack/react-router";
import {
  playToSignal,
  resultsToTagMap,
  type PlayTagRequest,
} from "@/lib/core/llm-tagging";
import type { Down, Play, Side } from "@/lib/core/types";
import { isXaiConfigured, tagPlays } from "@/lib/server/xai-tagger";

type ClientPlayInput = {
  id: string;
  side: Side;
  down?: Down;
  distance?: number;
  yardLine?: number;
  yardsGained?: number;
  result?: Play["result"];
  notes?: string;
  tags?: Play["tags"];
  visionHint?: string;
};

function isSide(v: unknown): v is Side {
  return v === "offense" || v === "defense" || v === "special";
}

function parseBody(raw: unknown): { filmId: string; plays: ClientPlayInput[] } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Body must be a JSON object");
  }
  const o = raw as Record<string, unknown>;
  const filmId = typeof o.filmId === "string" ? o.filmId : "";
  if (!filmId || filmId.length > 128) {
    throw new Error("filmId is required");
  }
  if (!Array.isArray(o.plays)) {
    throw new Error("plays array is required");
  }
  if (o.plays.length === 0) {
    throw new Error("plays must not be empty");
  }
  if (o.plays.length > 120) {
    throw new Error("at most 120 plays per request");
  }

  const plays: ClientPlayInput[] = [];
  for (const row of o.plays) {
    if (!row || typeof row !== "object") continue;
    const p = row as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id) continue;
    if (!isSide(p.side)) continue;
    plays.push({
      id: p.id,
      side: p.side,
      down:
        p.down === 1 || p.down === 2 || p.down === 3 || p.down === 4
          ? p.down
          : undefined,
      distance: typeof p.distance === "number" ? p.distance : undefined,
      yardLine: typeof p.yardLine === "number" ? p.yardLine : undefined,
      yardsGained: typeof p.yardsGained === "number" ? p.yardsGained : undefined,
      result:
        typeof p.result === "string" ? (p.result as Play["result"]) : undefined,
      notes: typeof p.notes === "string" ? p.notes : undefined,
      tags: Array.isArray(p.tags) ? (p.tags as Play["tags"]) : undefined,
      visionHint: typeof p.visionHint === "string" ? p.visionHint : undefined,
    });
  }
  if (plays.length === 0) {
    throw new Error("no valid plays in request");
  }
  return { filmId, plays };
}

function toRequests(plays: ClientPlayInput[]): PlayTagRequest[] {
  return plays.map((p) => {
    const asPlay: Play = {
      id: p.id,
      filmId: "",
      index: 0,
      startSec: 0,
      endSec: 1,
      quarter: 1,
      clock: "0:00",
      side: p.side,
      down: p.down,
      distance: p.distance,
      yardLine: p.yardLine,
      yardsGained: p.yardsGained,
      result: p.result,
      notes: p.notes,
      tags: p.tags ?? [],
    };
    return {
      playId: p.id,
      signal: playToSignal(asPlay, p.visionHint),
    };
  });
}

export const Route = createFileRoute("/api/film/tag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        let parsed: { filmId: string; plays: ClientPlayInput[] };
        try {
          parsed = parseBody(body);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Bad request";
          return Response.json({ error: message }, { status: 400 });
        }

        try {
          const tagged = await tagPlays(toRequests(parsed.plays));
          return Response.json(
            {
              filmId: parsed.filmId,
              mode: tagged.mode,
              xaiConfigured: isXaiConfigured(),
              playTags: resultsToTagMap(tagged.results),
              warning: tagged.warning,
            },
            {
              status: 200,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (err) {
          console.error("[api/film/tag]", err);
          return Response.json(
            {
              error: err instanceof Error ? err.message : "Tagging failed",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
