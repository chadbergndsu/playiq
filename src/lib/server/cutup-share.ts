/**
 * Persist public cutup share snapshots (server-only).
 * Insert-only: tokens are capability secrets; no anonymous overwrite.
 */

import { getSql } from "@/lib/db";
import type { CutupShareSnapshot } from "@/lib/core/types";

export class ShareTokenConflictError extends Error {
  constructor(token: string) {
    super(`Share token already exists: ${token}`);
    this.name = "ShareTokenConflictError";
  }
}

export async function saveCutupShare(snapshot: CutupShareSnapshot): Promise<void> {
  const sql = await getSql();
  // Insert-only — never UPSERT. Prevents unauthenticated share hijack.
  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Postgres unique_violation 23505 / PGLite similar
    if (
      /unique|duplicate|23505/i.test(msg) ||
      (err as { code?: string })?.code === "23505"
    ) {
      throw new ShareTokenConflictError(snapshot.token);
    }
    throw err;
  }
}

export async function loadCutupShare(
  token: string,
): Promise<CutupShareSnapshot | null> {
  const sql = await getSql();
  const rows = await sql.query<{ payload: string }>(
    `select payload from cutup_shares where token = $1 limit 1`,
    [token],
  );
  const row = rows[0];
  if (!row?.payload) return null;
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
