import { createFileRoute } from "@tanstack/react-router";
import { buildHealthReport } from "@/lib/core/health";
import { isXaiConfigured } from "@/lib/server/xai-tagger";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const report = buildHealthReport({
          service: "playiq",
          version: "0.1.0",
          dbReady: true,
          xaiConfigured: isXaiConfigured(),
        });
        return Response.json(report, {
          status: report.status === "ok" ? 200 : 503,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
