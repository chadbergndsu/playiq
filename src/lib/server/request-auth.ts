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

const databaseConfigured = Boolean(
  typeof process !== "undefined" && process.env.DATABASE_URL?.trim(),
);

function bearerFromRequest(request: Request): string | undefined {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || undefined;
}

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
  if (!authConfigured) {
    if (databaseConfigured) {
      throw new Error(
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

export function unauthorizedJson(): Response {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
