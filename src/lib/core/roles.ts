/**
 * Team staff roles — framework-free helpers.
 */

export const TEAM_ROLES = ["admin", "head_coach", "coach", "parent"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  head_coach: "Head coach",
  coach: "Coach",
  parent: "Parent",
};

export function isTeamRole(v: unknown): v is TeamRole {
  return typeof v === "string" && (TEAM_ROLES as readonly string[]).includes(v);
}

/** Normalize invite emails: trim + lowercase. Empty → null. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const email = raw.trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) return null;
  return email;
}

/** Parse PLAYIQ_ADMIN_EMAILS=a@x.com,b@y.com */
export function parseAdminEmailsEnv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const email = normalizeEmail(part);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Staff who use the film room (not parents). */
export function isStaff(role: TeamRole | null | undefined): boolean {
  return role === "admin" || role === "head_coach" || role === "coach";
}

export function canManageTeam(role: TeamRole | null | undefined): boolean {
  return role === "admin";
}

export function canUseFilmRoom(role: TeamRole | null | undefined): boolean {
  return isStaff(role);
}

export function isParent(role: TeamRole | null | undefined): boolean {
  return role === "parent";
}

export function postLoginPath(role: TeamRole | null | undefined): string {
  if (role === "parent") return "/parent";
  return "/app";
}
