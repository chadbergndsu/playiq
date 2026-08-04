import { createFileRoute } from "@tanstack/react-router";
import {
  loadCutupShare,
  saveCutupShare,
  ShareTokenConflictError,
} from "@/lib/server/cutup-share";
import { checkRateLimit, clientKey } from "@/lib/server/rate-limit";
import {
  mintShareToken,
  normalizeShareSnapshot,
} from "@/lib/server/share-validate";

export const Route = createFileRoute("/api/share/cutup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(clientKey(request, "share-post"), {
          limit: 20,
          windowMs: 60_000,
        });
        if (!rl.ok) {
          return Response.json(
            { error: "Too many share requests" },
            {
              status: 429,
              headers: {
                "Retry-After": String(rl.retryAfterSec),
                "Cache-Control": "no-store",
              },
            },
          );
        }

        let body: unknown;
        try {
          const text = await request.text();
          if (text.length > 300_000) {
            return Response.json(
              { error: "Payload too large" },
              { status: 413, headers: { "Cache-Control": "no-store" } },
            );
          }
          body = JSON.parse(text) as unknown;
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        // Always server-mint — never trust client token for create.
        const token = mintShareToken();
        const snapshot = normalizeShareSnapshot(body, token);
        if (!snapshot) {
          return Response.json(
            { error: "Invalid share snapshot" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        try {
          await saveCutupShare(snapshot);
          return Response.json(
            { ok: true, token: snapshot.token, path: `/share/${snapshot.token}` },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof ShareTokenConflictError) {
            // Astronomically rare with CSPRNG; mint once more.
            const retryToken = mintShareToken();
            const retry = { ...snapshot, token: retryToken };
            try {
              await saveCutupShare(retry);
              return Response.json(
                { ok: true, token: retry.token, path: `/share/${retry.token}` },
                { headers: { "Cache-Control": "no-store" } },
              );
            } catch {
              /* fall through */
            }
          }
          console.error("[api/share/cutup POST]", err);
          return Response.json(
            { error: "Save failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
      GET: async ({ request }) => {
        const rl = checkRateLimit(clientKey(request, "share-get"), {
          limit: 120,
          windowMs: 60_000,
        });
        if (!rl.ok) {
          return Response.json(
            { error: "Too many requests" },
            {
              status: 429,
              headers: {
                "Retry-After": String(rl.retryAfterSec),
                "Cache-Control": "no-store",
              },
            },
          );
        }

        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        if (!token || token.length < 12 || token.length > 80) {
          return Response.json(
            { error: "token required" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        try {
          const snap = await loadCutupShare(token);
          if (!snap) {
            return Response.json(
              { error: "Share not found" },
              { status: 404, headers: { "Cache-Control": "no-store" } },
            );
          }
          return Response.json(snap, {
            headers: { "Cache-Control": "private, no-store" },
          });
        } catch (err) {
          console.error("[api/share/cutup GET]", err);
          return Response.json(
            { error: "Load failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
