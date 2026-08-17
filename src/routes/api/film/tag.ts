import { createFileRoute } from "@tanstack/react-router";
import {
  clampVisionHint,
  playToSignal,
  resultsToTagMap,
  type PlayTagRequest,
} from "@/lib/core/llm-tagging";
import type { Down, Play, Side } from "@/lib/core/types";
import { checkRateLimit, clientKey } from "@/lib/server/rate-limit";
import {
  AuthMisconfiguredError,
  resolveApiIdentity,
} from "@/lib/server/request-auth";
import { isStaff } from "@/lib/core/roles";
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
  visionHint?: string;
};

function isSide(v: unknown): v is Side {
  return v === "offense" || v === "defense" || v === "special";
}

function finiteNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseFilmTagBody(raw: unknown): {
  filmId: string;
  plays: ClientPlayInput[];
  dropped: number;
} {
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
  let dropped = 0;
  for (const row of o.plays) {
    if (!row || typeof row !== "object") {
      dropped += 1;
      continue;
    }
    const p = row as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id || p.id.length > 128) {
      dropped += 1;
      continue;
    }
    if (!isSide(p.side)) {
      dropped += 1;
      continue;
    }
    // Intentionally ignore client `tags` — untrusted; server rebuilds signals.
    plays.push({
      id: p.id,
      side: p.side,
      down:
        p.down === 1 || p.down === 2 || p.down === 3 || p.down === 4
          ? p.down
          : undefined,
      distance: finiteNum(p.distance),
      yardLine: finiteNum(p.yardLine),
      yardsGained: finiteNum(p.yardsGained),
      result:
        typeof p.result === "string"
          ? (p.result.slice(0, 32) as Play["result"])
          : undefined,
      notes: clampVisionHint(typeof p.notes === "string" ? p.notes : undefined),
      visionHint: clampVisionHint(
        typeof p.visionHint === "string" ? p.visionHint : undefined,
      ),
    });
  }
  if (plays.length === 0) {
    throw new Error("no valid plays in request");
  }
  return { filmId, plays, dropped };
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
      tags: [],
    };
    return {
      playId: p.id,
      signal: playToSignal(asPlay, p.visionHint),
    };
  });
}

/** Coach-safe public warning — never mention API keys or provider details. */
function publicWarning(
  internal: string | undefined,
  dropped: number,
  usedHeuristicOnly: boolean,
): string | undefined {
  const parts: string[] = [];
  if (usedHeuristicOnly) {
    parts.push("Used local analysis rules (sign in for live AI when configured).");
  } else if (internal) {
    parts.push("Some plays used local rules after analysis issues.");
  }
  if (dropped > 0) parts.push(`${dropped} invalid play row(s) ignored.`);
  return parts.length ? parts.join(" ") : undefined;
}

export const Route = createFileRoute("/api/film/tag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(clientKey(request, "film-tag"), {
          limit: 15,
          windowMs: 60_000,
        });
        if (!rl.ok) {
          return Response.json(
            { error: "Too many tagging requests" },
            {
              status: 429,
              headers: {
                "Retry-After": String(rl.retryAfterSec),
                "Cache-Control": "no-store",
              },
            },
          );
        }

        // Paid LLM only for signed-in *staff* when auth is on.
        // Auth-off local demo (no DATABASE_URL): treat as staff (DEV_USER admin).
        let allowLlm = false;
        try {
          const { identity, authOn } = await resolveApiIdentity(request);
          if (!authOn) {
            allowLlm = Boolean(identity?.userId);
          } else {
            allowLlm = Boolean(identity && isStaff(identity.role));
          }
        } catch (err) {
          if (err instanceof AuthMisconfiguredError) {
            // Still allow heuristic tagging when auth is misconfigured.
            allowLlm = false;
          } else {
            console.error("[api/film/tag auth]", err);
            allowLlm = false;
          }
        }

        let body: unknown;
        try {
          const text = await request.text();
          if (text.length > 512_000) {
            return Response.json(
              { error: "Payload too large" },
              { status: 413, headers: { "Cache-Control": "no-store" } },
            );
          }
          body = JSON.parse(text) as unknown;
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        let parsed: { filmId: string; plays: ClientPlayInput[]; dropped: number };
        try {
          parsed = parseFilmTagBody(body);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Bad request";
          return Response.json(
            { error: message },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        try {
          // Never call paid LLM for anonymous sessions when a key is configured.
          const forceHeuristic = isXaiConfigured() && !allowLlm;
          const tagged = await tagPlays(toRequests(parsed.plays), {
            forceHeuristic,
          });
          return Response.json(
            {
              filmId: parsed.filmId,
              // Opaque public mode — do not reveal llm vs heuristic for recon.
              mode: "ok",
              xaiConfigured: false,
              playTags: resultsToTagMap(tagged.results),
              warning: publicWarning(
                tagged.warning,
                parsed.dropped,
                forceHeuristic || tagged.mode === "heuristic",
              ),
            },
            {
              status: 200,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (err) {
          console.error("[api/film/tag]", err);
          return Response.json(
            { error: "Tagging failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
