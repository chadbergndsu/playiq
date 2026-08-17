/**
 * Persist public cutup share snapshots (server-only).
 * Insert-only: tokens are capability secrets; no anonymous overwrite.
 * Shares expire after SHARE_TTL_DAYS (default 30).
 */

import { getSql } from "@/lib/db";
import type { CutupShareSnapshot } from "@/lib/core/types";

export const SHARE_TTL_DAYS = 30;

export class ShareTokenConflictError extends Error {
  constructor(token: string) {
    super(`Share token already exists: ${token}`);
    this.name = "ShareTokenConflictError";
  }
}

export function defaultShareExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function saveCutupShare(
  snapshot: CutupShareSnapshot,
  opts: { createdBy?: string | null; expiresAt?: Date } = {},
): Promise<{ expiresAt: string }> {
  const sql = await getSql();
  const expiresAt = opts.expiresAt ?? defaultShareExpiresAt();
  try {
    await sql.query(
      `insert into cutup_shares (token, title, description, payload, expires_at, created_by)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        snapshot.token,
        snapshot.title,
        snapshot.description,
        JSON.stringify(snapshot),
        expiresAt.toISOString(),
        opts.createdBy ?? null,
      ],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /unique|duplicate|23505/i.test(msg) ||
      (err as { code?: string })?.code === "23505"
    ) {
      throw new ShareTokenConflictError(snapshot.token);
    }
    // Column missing on pre-migration DBs: retry without new columns.
    if (/expires_at|created_by|column/i.test(msg)) {
      await sql.query(
        `insert into cutup_shares (token, title, description, payload)
         values ($1, $2, $3, $4)`,
        [
          snapshot.token,
          snapshot.title,
          snapshot.description,
          JSON.stringify(snapshot),
        ],
      );
      return { expiresAt: expiresAt.toISOString() };
    }
    throw err;
  }
  return { expiresAt: expiresAt.toISOString() };
}

export async function loadCutupShare(
  token: string,
): Promise<CutupShareSnapshot | null> {
  const sql = await getSql();
  let rows: Array<{ payload: string; expires_at?: string | Date | null }>;
  try {
    rows = await sql.query<{ payload: string; expires_at?: string | Date | null }>(
      `select payload, expires_at from cutup_shares where token = $1 limit 1`,
      [token],
    );
  } catch {
    rows = await sql.query<{ payload: string }>(
      `select payload from cutup_shares where token = $1 limit 1`,
      [token],
    );
  }
  const row = rows[0];
  if (!row?.payload) return null;

  if (row.expires_at != null) {
    const exp =
      row.expires_at instanceof Date
        ? row.expires_at
        : new Date(String(row.expires_at));
    if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(row.payload) as CutupShareSnapshot;
    if (parsed.version !== 1 || !Array.isArray(parsed.plays)) {
      console.error("[cutup-share] corrupt payload for token", token.slice(0, 12));
      return null;
    }
    return parsed;
  } catch {
    console.error("[cutup-share] JSON parse failed for token", token.slice(0, 12));
    return null;
  }
}

/** Lightweight readiness for health checks. */
export async function pingDatabase(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`select 1 as ok`);
    return true;
  } catch (err) {
    console.error("[cutup-share] db ping failed", err);
    return false;
  }
}
