import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedError } from "@/lib/auth/verify.server";
import { postLoginPath, ROLE_LABELS } from "@/lib/core/roles";
import {
  AuthMisconfiguredError,
  resolveApiIdentity,
  unauthorizedJson,
} from "@/lib/server/request-auth";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { identity, authOn } = await resolveApiIdentity(request);
          if (authOn && !identity) {
            return Response.json(
              { user: null, role: null },
              { status: 200, headers: { "Cache-Control": "no-store" } },
            );
          }
          if (!identity) {
            return Response.json(
              { user: null, role: null },
              { status: 200, headers: { "Cache-Control": "no-store" } },
            );
          }
          return Response.json(
            {
              user: {
                id: identity.userId,
                email: identity.email,
              },
              role: identity.role,
              roleLabel: identity.role ? ROLE_LABELS[identity.role] : null,
              member: identity.member
                ? {
                    id: identity.member.id,
                    email: identity.member.email,
                    linked: Boolean(identity.member.userId),
                  }
                : null,
              postLoginPath: postLoginPath(identity.role),
              authOn: identity.authOn,
            },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof UnauthorizedError) return unauthorizedJson();
          if (err instanceof AuthMisconfiguredError) {
            return Response.json(
              { error: "Auth misconfigured" },
              { status: 503, headers: { "Cache-Control": "no-store" } },
            );
          }
          console.error("[api/me]", err);
          return Response.json(
            { error: "Failed to resolve session" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
