/**
 * Auth helpers for raw API route handlers (not createServerFn middleware).
 */

import {
  authConfigured,
  getSessionUser,
  UnauthorizedError,
  DEV_USER_ID,
} from "@/lib/auth/verify.server";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import {
  canManageTeam,
  canUseFilmRoom,
  isStaff,
  type TeamRole,
} from "@/lib/core/roles";
import { resolveMemberForUser, type TeamMemberRow } from "@/lib/server/team-members";

const databaseConfigured = Boolean(
  typeof process !== "undefined" && process.env.DATABASE_URL?.trim(),
);

export class AuthMisconfiguredError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "AuthMisconfiguredError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function bearerFromRequest(request: Request): string | undefined {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || undefined;
}

export type ApiIdentity = {
  userId: string;
  email: string | null;
  role: TeamRole | null;
  member: TeamMemberRow | null;
  authOn: boolean;
};

/**
 * Same-site check + optional session for mutating public APIs.
 * - Auth on: returns user id or null if signed out
 * - Auth off + no DATABASE_URL: returns DEV_USER_ID (local demo)
 * - Auth off + DATABASE_URL: throws (fail closed)
 */
export async function resolveApiUser(
  request: Request,
): Promise<{ userId: string | null; authOn: boolean }> {
  assertSameSiteRequest();
  // Lazy-load config error so health can stay up if auth module is soft-failed.
  const { authConfigError } = await import("@/lib/auth/server");
  if (authConfigError) {
    throw new AuthMisconfiguredError(authConfigError);
  }
  if (!authConfigured) {
    if (databaseConfigured) {
      throw new AuthMisconfiguredError(
        "Auth is disabled but DATABASE_URL is set — refusing unscoped API writes.",
      );
    }
    return { userId: DEV_USER_ID, authOn: false };
  }
  const user = await getSessionUser(bearerFromRequest(request));
  return { userId: user?.id ?? null, authOn: true };
}

/** Require a signed-in user when auth is enabled. */
export async function requireApiUser(request: Request): Promise<string> {
  const { userId, authOn } = await resolveApiUser(request);
  if (authOn && !userId) throw new UnauthorizedError();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

/**
 * Resolve signed-in user + team role (links invite on first match).
 * Auth-off local demo → admin so staff APIs work in development.
 */
export async function resolveApiIdentity(request: Request): Promise<{
  identity: ApiIdentity | null;
  authOn: boolean;
}> {
  assertSameSiteRequest();
  const { authConfigError } = await import("@/lib/auth/server");
  if (authConfigError) {
    throw new AuthMisconfiguredError(authConfigError);
  }

  if (!authConfigured) {
    if (databaseConfigured) {
      throw new AuthMisconfiguredError(
        "Auth is disabled but DATABASE_URL is set — refusing unscoped API writes.",
      );
    }
    return {
      authOn: false,
      identity: {
        userId: DEV_USER_ID,
        email: "dev@example.com",
        role: "admin",
        member: null,
        authOn: false,
      },
    };
  }

  const user = await getSessionUser(bearerFromRequest(request));
  if (!user) return { identity: null, authOn: true };

  const member = await resolveMemberForUser({
    userId: user.id,
    email: user.email,
  });

  return {
    authOn: true,
    identity: {
      userId: user.id,
      email: user.email,
      role: member?.role ?? null,
      member,
      authOn: true,
    },
  };
}

export async function requireApiIdentity(request: Request): Promise<ApiIdentity> {
  const { identity, authOn } = await resolveApiIdentity(request);
  if (authOn && !identity) throw new UnauthorizedError();
  if (!identity) throw new UnauthorizedError();
  return identity;
}

export async function requireStaff(request: Request): Promise<ApiIdentity> {
  const identity = await requireApiIdentity(request);
  if (!isStaff(identity.role)) {
    throw new ForbiddenError("Staff role required");
  }
  return identity;
}

export async function requireTeamAdmin(request: Request): Promise<ApiIdentity> {
  const identity = await requireApiIdentity(request);
  if (!canManageTeam(identity.role)) {
    throw new ForbiddenError("Admin role required");
  }
  return identity;
}

export function unauthorizedJson(): Response {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function forbiddenJson(message = "Forbidden"): Response {
  return Response.json(
    { error: message },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export { canUseFilmRoom, canManageTeam, isStaff };
