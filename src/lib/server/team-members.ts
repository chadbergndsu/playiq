/**
 * team_members persistence — server-only.
 */

import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  isTeamRole,
  normalizeEmail,
  parseAdminEmailsEnv,
  type TeamRole,
} from "@/lib/core/roles";

export type TeamMemberRow = {
  id: string;
  email: string;
  role: TeamRole;
  userId: string | null;
  displayName: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  display_name: string | null;
  invited_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(v: string | Date): string {
  return typeof v === "string" ? v : v.toISOString();
}

function mapRow(r: DbRow): TeamMemberRow {
  if (!isTeamRole(r.role)) {
    throw new Error(`Invalid team role in DB: ${r.role}`);
  }
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    userId: r.user_id,
    displayName: r.display_name,
    invitedBy: r.invited_by,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function newId(): string {
  return `tm_${randomBytes(12).toString("hex")}`;
}

export async function listMembers(): Promise<TeamMemberRow[]> {
  const sql = await getSql();
  const rows = await sql.query<DbRow>(
    `select id, email, role, user_id, display_name, invited_by, created_at, updated_at
     from team_members
     order by role asc, email asc`,
  );
  return rows.map(mapRow);
}

export async function getMemberByEmail(
  emailRaw: string,
): Promise<TeamMemberRow | null> {
  const email = normalizeEmail(emailRaw);
  if (!email) return null;
  const sql = await getSql();
  const rows = await sql.query<DbRow>(
    `select id, email, role, user_id, display_name, invited_by, created_at, updated_at
     from team_members where email = $1 limit 1`,
    [email],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getMemberById(id: string): Promise<TeamMemberRow | null> {
  const sql = await getSql();
  const rows = await sql.query<DbRow>(
    `select id, email, role, user_id, display_name, invited_by, created_at, updated_at
     from team_members where id = $1 limit 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function countAdmins(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from team_members where role = 'admin'`,
  );
  return rows[0]?.n ?? 0;
}

/** Upsert invite by email. Returns the member row. */
export async function upsertInvite(input: {
  email: string;
  role: TeamRole;
  invitedBy?: string | null;
  displayName?: string | null;
}): Promise<TeamMemberRow> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("Invalid email");
  if (!isTeamRole(input.role)) throw new Error("Invalid role");

  const existing = await getMemberByEmail(email);
  const sql = await getSql();
  const now = new Date().toISOString();

  if (existing) {
    // Demoting last admin is blocked by callers; still guard here.
    if (existing.role === "admin" && input.role !== "admin") {
      const n = await countAdmins();
      if (n <= 1) throw new Error("Cannot demote the last admin");
    }
    await sql.query(
      `update team_members
       set role = $2, display_name = coalesce($3, display_name),
           invited_by = coalesce($4, invited_by), updated_at = $5
       where id = $1`,
      [existing.id, input.role, input.displayName ?? null, input.invitedBy ?? null, now],
    );
    return (await getMemberById(existing.id))!;
  }

  const id = newId();
  await sql.query(
    `insert into team_members (id, email, role, user_id, display_name, invited_by, created_at, updated_at)
     values ($1, $2, $3, null, $4, $5, $6, $6)`,
    [id, email, input.role, input.displayName ?? null, input.invitedBy ?? null, now],
  );
  return (await getMemberById(id))!;
}

export async function updateMemberRole(
  id: string,
  role: TeamRole,
): Promise<TeamMemberRow> {
  if (!isTeamRole(role)) throw new Error("Invalid role");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("Member not found");
  if (existing.role === "admin" && role !== "admin") {
    const n = await countAdmins();
    if (n <= 1) throw new Error("Cannot demote the last admin");
  }
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql.query(`update team_members set role = $2, updated_at = $3 where id = $1`, [
    id,
    role,
    now,
  ]);
  return (await getMemberById(id))!;
}

export async function removeMember(id: string): Promise<void> {
  const existing = await getMemberById(id);
  if (!existing) throw new Error("Member not found");
  if (existing.role === "admin") {
    const n = await countAdmins();
    if (n <= 1) throw new Error("Cannot remove the last admin");
  }
  const sql = await getSql();
  await sql.query(`delete from team_members where id = $1`, [id]);
}

/** Link Better Auth user id on first matching login. */
export async function linkUserId(
  emailRaw: string,
  userId: string,
  displayName?: string | null,
): Promise<TeamMemberRow | null> {
  const email = normalizeEmail(emailRaw);
  if (!email || !userId) return null;
  const member = await getMemberByEmail(email);
  if (!member) return null;
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql.query(
    `update team_members
     set user_id = $2,
         display_name = coalesce($3, display_name),
         updated_at = $4
     where id = $1`,
    [member.id, userId, displayName ?? null, now],
  );
  return getMemberById(member.id);
}

/**
 * Bootstrap admins from PLAYIQ_ADMIN_EMAILS.
 * Idempotent — inserts missing emails as admin; does not demote existing roles.
 */
export async function ensureAdminEmailsFromEnv(
  envValue = process.env.PLAYIQ_ADMIN_EMAILS,
): Promise<string[]> {
  const emails = parseAdminEmailsEnv(envValue);
  const created: string[] = [];
  for (const email of emails) {
    const existing = await getMemberByEmail(email);
    if (existing) continue;
    await upsertInvite({ email, role: "admin", invitedBy: "env:PLAYIQ_ADMIN_EMAILS" });
    created.push(email);
  }
  return created;
}

/**
 * Resolve role for a signed-in user: ensure env admins, match email, link user_id.
 */
export async function resolveMemberForUser(input: {
  userId: string;
  email: string | null;
  displayName?: string | null;
}): Promise<TeamMemberRow | null> {
  await ensureAdminEmailsFromEnv();
  if (!input.email) return null;
  const email = normalizeEmail(input.email);
  if (!email) return null;
  let member = await getMemberByEmail(email);
  if (!member) return null;
  if (member.userId !== input.userId) {
    member = (await linkUserId(email, input.userId, input.displayName)) ?? member;
  }
  return member;
}
