/**
 * Team roster — empty by default in the public product.
 * Coaches add jersey numbers in the film room; no student names ship in git.
 */

export type RosterPlayer = {
  first: string;
  last: string;
  number: number;
  grade?: number;
  team?: string;
};

/** Public default: no players. Local/private deploys may inject via app data later. */
export const TEAM_ROSTER: RosterPlayer[] = [];

/** @deprecated Use TEAM_ROSTER */
export const TIGERS_3RD_ROSTER = TEAM_ROSTER;

const byNumber = new Map(TEAM_ROSTER.map((p) => [p.number, p]));

export const ROSTER_POSTER_URL: string | null = null;
export const ROSTER_LABEL = "Team roster";

export function playerByNumber(n: number): RosterPlayer | undefined {
  return byNumber.get(n);
}

export function formatPlayer(p: RosterPlayer): string {
  const name = `${p.first} ${p.last}`.trim();
  return name ? `${name} #${p.number}` : `#${p.number}`;
}

export function formatJersey(n: number): string | undefined {
  const p = playerByNumber(n);
  if (p) return formatPlayer(p);
  if (!Number.isFinite(n)) return undefined;
  return `#${n}`;
}

export function rosterSortedByNumber(): RosterPlayer[] {
  return [...TEAM_ROSTER].sort((a, b) => a.number - b.number);
}

export function rosterSortedByName(): RosterPlayer[] {
  return [...TEAM_ROSTER].sort((a, b) =>
    a.last === b.last ? a.first.localeCompare(b.first) : a.last.localeCompare(b.last),
  );
}

export function searchRoster(q: string): RosterPlayer[] {
  const needle = q.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return rosterSortedByName();
  return TEAM_ROSTER.filter((p) => {
    return (
      String(p.number) === needle ||
      p.first.toLowerCase().includes(needle) ||
      p.last.toLowerCase().includes(needle) ||
      `${p.first} ${p.last}`.toLowerCase().includes(needle)
    );
  });
}
