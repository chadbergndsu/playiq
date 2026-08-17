/**
 * Youth / school quick-tag palette — honest, coach-first vocabulary.
 */

import type { TagCategory } from "./types";
import { DEFAULT_SCHOOL } from "./school";

export type YouthQuickTag = {
  label: string;
  category: TagCategory;
};

export const YOUTH_QUICK_TAGS: YouthQuickTag[] = [
  { label: "Inside run", category: "concept" },
  { label: "Outside run", category: "concept" },
  { label: "Unused WR", category: "coach_note" },
  { label: "Missed contain", category: "coach_note" },
  { label: "Tackle", category: "coach_note" },
  { label: "Dies in box", category: "coach_note" },
  { label: "Bounce to bench", category: "coach_note" },
];

/** Display label — prefer unlocked school name from the client when available. */
export const YOUTH_TEAM_LABEL = DEFAULT_SCHOOL.name;
