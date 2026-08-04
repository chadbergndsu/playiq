/**
 * Persist public cutup share snapshots (server-only).
 */

import { getSql } from "@/lib/db";
import type { CutupShareSnapshot } from "@/lib/core/types";

export async function saveCutupShare(snapshot: CutupShareSnapshot): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into cutup_shares (token, title, description, payload)
     values ($1, $2, $3, $4)
     on conflict (token) do update set
       title = excluded.title,
       description = excluded.description,
       payload = excluded.payload`,
    [
      snapshot.token,
      snapshot.title,
      snapshot.description,
      JSON.stringify(snapshot),
    ],
  );
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
    if (parsed.version !== 1 || !Array.isArray(parsed.plays)) return null;
    return parsed;
  } catch {
    return null;
  }
}
