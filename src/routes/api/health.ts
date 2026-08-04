import { createFileRoute } from "@tanstack/react-router";
import { buildHealthReport } from "@/lib/core/health";
import { pingDatabase } from "@/lib/server/cutup-share";
import { isXaiConfigured } from "@/lib/server/xai-tagger";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const dbReady = await pingDatabase();
        const report = buildHealthReport({
          service: "playiq",
          version: "1.1.1",
          dbReady,
          // Keep xAI presence internal — public report only reflects critical checks.
          // Pass a configured flag so ops tooling can still see it if they read checks,
          // but we map it to a non-critical key that doesn't affect status.
          xaiConfigured: isXaiConfigured(),
        });
        // Strip xAI from public payload to reduce recon (optional key still in logs).
        const { xai: _xai, ...publicChecks } = report.checks;
        const publicReport = {
          status: report.status,
          service: report.service,
          version: report.version,
          timestamp: report.timestamp,
          checks: publicChecks,
        };
        return Response.json(publicReport, {
          status: report.status === "ok" ? 200 : 503,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
