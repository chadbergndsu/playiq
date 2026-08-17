import { useEffect, useState } from "react";
import { authClient, authEnabled, getBearerToken } from "./client";
import type { TeamRole } from "@/lib/core/roles";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** Team role from invite match; null when signed in but not invited. */
  role: TeamRole | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is explicitly disabled
 * (`VITE_AUTH_ENABLED=false`). Treated as admin so local staff APIs work.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  role: "admin",
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

type MeResponse = {
  user: { id: string; email: string | null } | null;
  role: TeamRole | null;
  postLoginPath?: string;
};

async function fetchMe(): Promise<MeResponse | null> {
  const headers: Record<string, string> = {};
  try {
    const bearer = getBearerToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  } catch {
    /* optional */
  }
  const res = await fetch("/api/me", { credentials: "include", headers });
  if (!res.ok) return null;
  return (await res.json()) as MeResponse;
}

/**
 * Current user + loading state, including team role from `/api/me`.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const { data, isPending: sessionPending } = authClient.useSession();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [role, setRole] = useState<TeamRole | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [rolePending, setRolePending] = useState(false);

  const sessionUser = data?.user;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!sessionUser) {
      setRole(null);
      setRolePending(false);
      return;
    }
    let cancelled = false;
    setRolePending(true);
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        setRole(me?.role ?? null);
      })
      .finally(() => {
        if (!cancelled) setRolePending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionUser?.id, sessionUser?.email]);

  const isPending = sessionPending || (Boolean(sessionUser) && rolePending);

  return {
    user: sessionUser
      ? {
          id: sessionUser.id,
          displayName: sessionUser.name ?? null,
          primaryEmail: sessionUser.email ?? null,
          profileImageUrl: sessionUser.image ?? null,
          role,
          isDevFallback: false,
        }
      : null,
    isPending,
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display.
 * NOTE: `null` means *loading OR signed out* — for redirects use `useCurrentUserState()`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}

/** Refetch helper for after admin invite (optional). */
export async function refreshMeRole(): Promise<TeamRole | null> {
  const me = await fetchMe();
  return me?.role ?? null;
}
