import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedError } from "@/lib/auth/verify.server";
import { isTeamRole, normalizeEmail, ROLE_LABELS, TEAM_ROLES } from "@/lib/core/roles";
import {
  AuthMisconfiguredError,
  ForbiddenError,
  forbiddenJson,
  requireTeamAdmin,
  unauthorizedJson,
} from "@/lib/server/request-auth";
import {
  ensureAdminEmailsFromEnv,
  listMembers,
  removeMember,
  updateMemberRole,
  upsertInvite,
} from "@/lib/server/team-members";

function authErrorResponse(err: unknown): Response | null {
  if (err instanceof UnauthorizedError) return unauthorizedJson();
  if (err instanceof ForbiddenError) return forbiddenJson(err.message);
  if (err instanceof AuthMisconfiguredError) {
    return Response.json(
      { error: "Auth misconfigured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}

export const Route = createFileRoute("/api/team/members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireTeamAdmin(request);
          await ensureAdminEmailsFromEnv();
          const members = await listMembers();
          return Response.json(
            {
              members: members.map((m) => ({
                id: m.id,
                email: m.email,
                role: m.role,
                roleLabel: ROLE_LABELS[m.role],
                userId: m.userId,
                linked: Boolean(m.userId),
                displayName: m.displayName,
                invitedBy: m.invitedBy,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
              })),
              roles: TEAM_ROLES,
            },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const mapped = authErrorResponse(err);
          if (mapped) return mapped;
          console.error("[api/team/members GET]", err);
          return Response.json(
            { error: "Failed to list members" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const admin = await requireTeamAdmin(request);
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          const o = body as Record<string, unknown>;
          const email = normalizeEmail(typeof o.email === "string" ? o.email : "");
          const role = o.role;
          if (!email) {
            return Response.json(
              { error: "Valid email required" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          if (!isTeamRole(role)) {
            return Response.json(
              { error: "Invalid role" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          const member = await upsertInvite({
            email,
            role,
            invitedBy: admin.email ?? admin.userId,
            displayName: typeof o.displayName === "string" ? o.displayName : null,
          });
          return Response.json(
            {
              member: {
                id: member.id,
                email: member.email,
                role: member.role,
                roleLabel: ROLE_LABELS[member.role],
                linked: Boolean(member.userId),
              },
            },
            { status: 201, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const mapped = authErrorResponse(err);
          if (mapped) return mapped;
          const msg = err instanceof Error ? err.message : "Invite failed";
          if (/last admin|Invalid/i.test(msg)) {
            return Response.json(
              { error: msg },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          console.error("[api/team/members POST]", err);
          return Response.json(
            { error: "Invite failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      PATCH: async ({ request }) => {
        try {
          await requireTeamAdmin(request);
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          const o = body as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id : "";
          const role = o.role;
          if (!id) {
            return Response.json(
              { error: "id required" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          if (!isTeamRole(role)) {
            return Response.json(
              { error: "Invalid role" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          const member = await updateMemberRole(id, role);
          return Response.json(
            {
              member: {
                id: member.id,
                email: member.email,
                role: member.role,
                roleLabel: ROLE_LABELS[member.role],
                linked: Boolean(member.userId),
              },
            },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const mapped = authErrorResponse(err);
          if (mapped) return mapped;
          const msg = err instanceof Error ? err.message : "Update failed";
          if (/last admin|not found|Invalid/i.test(msg)) {
            return Response.json(
              { error: msg },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          console.error("[api/team/members PATCH]", err);
          return Response.json(
            { error: "Update failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          await requireTeamAdmin(request);
          const url = new URL(request.url);
          const id = url.searchParams.get("id")?.trim() ?? "";
          if (!id) {
            return Response.json(
              { error: "id required" },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          await removeMember(id);
          return Response.json(
            { ok: true },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const mapped = authErrorResponse(err);
          if (mapped) return mapped;
          const msg = err instanceof Error ? err.message : "Remove failed";
          if (/last admin|not found/i.test(msg)) {
            return Response.json(
              { error: msg },
              { status: 400, headers: { "Cache-Control": "no-store" } },
            );
          }
          console.error("[api/team/members DELETE]", err);
          return Response.json(
            { error: "Remove failed" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
