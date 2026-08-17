import { createFileRoute } from "@tanstack/react-router";
import {
  schoolCodeConfigured,
  schoolCodesMatch,
  schoolProfileFromEnv,
} from "@/lib/core/school";
import { checkRateLimit, clientKey } from "@/lib/server/rate-limit";

export const Route = createFileRoute("/api/school/unlock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = checkRateLimit(clientKey(request, "school-unlock"), {
          limit: 20,
          windowMs: 60_000,
        });
        if (!limited.ok) {
          return Response.json(
            { ok: false, error: "Too many unlock attempts. Try again shortly." },
            { status: 429 },
          );
        }

        let code = "";
        try {
          const body = (await request.json()) as { code?: string };
          code = typeof body.code === "string" ? body.code : "";
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const configured = process.env.PLAYIQ_SCHOOL_CODE;
        if (!schoolCodeConfigured(configured)) {
          return Response.json(
            {
              ok: false,
              error:
                "School code is not configured on this server. Set PLAYIQ_SCHOOL_CODE in the environment.",
            },
            { status: 503 },
          );
        }

        if (!schoolCodesMatch(configured, code)) {
          return Response.json({ ok: false, error: "Invalid school code" }, { status: 403 });
        }

        const school = schoolProfileFromEnv({
          name: process.env.PLAYIQ_SCHOOL_NAME,
          seasonLabel: process.env.PLAYIQ_SCHOOL_SEASON_LABEL,
        });

        return Response.json({ ok: true, school });
      },
    },
  },
});
