import { createFileRoute } from "@tanstack/react-router";
import type { CutupShareSnapshot } from "@/lib/core/types";
import { loadCutupShare, saveCutupShare } from "@/lib/server/cutup-share";

function isSnapshot(raw: unknown): raw is CutupShareSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.token === "string" &&
    o.token.length >= 8 &&
    o.token.length <= 80 &&
    typeof o.title === "string" &&
    Array.isArray(o.plays) &&
    o.plays.length <= 200
  );
}

export const Route = createFileRoute("/api/share/cutup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!isSnapshot(body)) {
          return Response.json({ error: "Invalid share snapshot" }, { status: 400 });
        }
        try {
          await saveCutupShare(body);
          return Response.json(
            { ok: true, token: body.token, path: `/share/${body.token}` },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          console.error("[api/share/cutup POST]", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Save failed" },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        if (!token || token.length > 80) {
          return Response.json({ error: "token required" }, { status: 400 });
        }
        try {
          const snap = await loadCutupShare(token);
          if (!snap) {
            return Response.json({ error: "Share not found" }, { status: 404 });
          }
          return Response.json(snap, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        } catch (err) {
          console.error("[api/share/cutup GET]", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Load failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
