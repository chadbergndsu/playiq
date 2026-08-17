/**
 * Team schedule — empty by default in the public product.
 * Coaches add games via upload/library; no real school calendar ships in git.
 */

export type ScheduleKind = "home" | "away" | "neutral" | "bye" | "playoff";

export type ScheduleGame = {
  id: string;
  date: string;
  weekday: string;
  opponent: string;
  location: string;
  time: string | null;
  kind: ScheduleKind;
  note?: string;
};

export const SCHEDULE_LABEL = "Season schedule";
export const SCHEDULE_POSTER_URL: string | null = null;

/** Public default: no games. */
export const TEAM_SCHEDULE: ScheduleGame[] = [];

/** @deprecated Use TEAM_SCHEDULE */
export const LEGACY_TEAM_SCHEDULE = TEAM_SCHEDULE;

export function nextGame(
  schedule: ScheduleGame[] = TEAM_SCHEDULE,
  from = new Date(),
): ScheduleGame | null {
  const today = from.toISOString().slice(0, 10);
  const upcoming = schedule
    .filter((g) => g.kind !== "bye" && g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
