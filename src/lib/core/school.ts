/**
 * School workspace identity — no real student/roster data in the public repo.
 * Coaches unlock with PLAYIQ_SCHOOL_CODE; display name from PLAYIQ_SCHOOL_NAME.
 */

export type SchoolProfile = {
  /** Public display label (never a list of students). */
  name: string;
  /** Short season label shown in the shell. */
  seasonLabel: string;
};

export const DEFAULT_SCHOOL: SchoolProfile = {
  name: "PlayIQ School",
  seasonLabel: "Film room",
};

export function normalizeSchoolCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function schoolCodeConfigured(raw: string | null | undefined): boolean {
  return normalizeSchoolCode(raw).length >= 4;
}

export function schoolCodesMatch(
  configured: string | null | undefined,
  submitted: string | null | undefined,
): boolean {
  const expected = normalizeSchoolCode(configured);
  const got = normalizeSchoolCode(submitted);
  if (!expected || !got) return false;
  return expected === got;
}

export function schoolProfileFromEnv(input: {
  name?: string | null;
  seasonLabel?: string | null;
}): SchoolProfile {
  const name = input.name?.trim() || DEFAULT_SCHOOL.name;
  const seasonLabel = input.seasonLabel?.trim() || DEFAULT_SCHOOL.seasonLabel;
  return { name, seasonLabel };
}
