/**
 * Open Play Ontology (OPO) — versioned, portable American football concept taxonomy.
 *
 * Inspired by open coaching literature and open stats naming (nflverse-style
 * free-text concepts), NOT proprietary Hudl Assist code windows.
 * Coaches own the vocabulary; AI tags map into stable IDs for exchange.
 */

export const ONTOLOGY_VERSION = "1.0.0" as const;

export type OntologyFamily =
  | "formation"
  | "personnel"
  | "run_game"
  | "pass_game"
  | "rpo"
  | "protection"
  | "coverage"
  | "front"
  | "pressure"
  | "special"
  | "situation"
  | "result";

export type OntologyEntry = {
  id: string;
  label: string;
  family: OntologyFamily;
  /** Alternate coach spellings / AI labels that normalize to this id */
  aliases: string[];
  side: "offense" | "defense" | "special" | "any";
  /** Free-text teaching note */
  blurb: string;
};

/** Canonical catalog — extend carefully; IDs are stable for OFP exchange. */
export const PLAY_ONTOLOGY: readonly OntologyEntry[] = [
  // Formations
  {
    id: "form.shotgun",
    label: "Shotgun",
    family: "formation",
    aliases: ["shotgun", "sg", "gun"],
    side: "offense",
    blurb: "QB depth off the ball under center-free.",
  },
  {
    id: "form.pistol",
    label: "Pistol",
    family: "formation",
    aliases: ["pistol"],
    side: "offense",
    blurb: "QB depth with RB stacked behind.",
  },
  {
    id: "form.under_center",
    label: "Under center",
    family: "formation",
    aliases: ["under center", "under-center", "i-form", "pro"],
    side: "offense",
    blurb: "QB under center; classic I/pro sets.",
  },
  {
    id: "form.empty",
    label: "Empty",
    family: "formation",
    aliases: ["empty", "empty set"],
    side: "offense",
    blurb: "No RB in backfield; five eligible receivers.",
  },
  {
    id: "form.trips",
    label: "Trips",
    family: "formation",
    aliases: ["trips", "3x1", "trey"],
    side: "offense",
    blurb: "Three receivers to one side.",
  },
  {
    id: "form.bunch",
    label: "Bunch",
    family: "formation",
    aliases: ["bunch", "stack", "tight bunch"],
    side: "offense",
    blurb: "Compressed receiver cluster for rubs / leverage.",
  },
  {
    id: "form.goal_line",
    label: "Goal line",
    family: "formation",
    aliases: ["goal line", "goal-line", "heavy", "jumbo"],
    side: "offense",
    blurb: "Heavy personnel near the goal line.",
  },
  // Personnel
  {
    id: "pers.11",
    label: "11 personnel",
    family: "personnel",
    aliases: ["11 personnel", "11", "1rb 1te", "3 wr"],
    side: "offense",
    blurb: "1 RB, 1 TE, 3 WR — modern base.",
  },
  {
    id: "pers.12",
    label: "12 personnel",
    family: "personnel",
    aliases: ["12 personnel", "12", "2 te"],
    side: "offense",
    blurb: "1 RB, 2 TE, 2 WR.",
  },
  {
    id: "pers.21",
    label: "21 personnel",
    family: "personnel",
    aliases: ["21 personnel", "21", "2 back"],
    side: "offense",
    blurb: "2 RB, 1 TE, 2 WR.",
  },
  // Run
  {
    id: "run.inside_zone",
    label: "Inside zone",
    family: "run_game",
    aliases: ["inside zone", "iz", "zone run"],
    side: "offense",
    blurb: "Zone path between the tackles.",
  },
  {
    id: "run.outside_zone",
    label: "Outside zone",
    family: "run_game",
    aliases: ["outside zone", "oz", "stretch", "wide zone"],
    side: "offense",
    blurb: "Stretch / wide zone edge path.",
  },
  {
    id: "run.power",
    label: "Power",
    family: "run_game",
    aliases: ["power", "gap power", "iso power"],
    side: "offense",
    blurb: "Gap scheme with puller / lead.",
  },
  {
    id: "run.counter",
    label: "Counter",
    family: "run_game",
    aliases: ["counter", "counter trey", "gt counter"],
    side: "offense",
    blurb: "Misdirection gap scheme.",
  },
  {
    id: "run.short_yardage",
    label: "Short yardage",
    family: "run_game",
    aliases: ["short yardage", "short-yardage"],
    side: "offense",
    blurb: "Situational short-yardage call.",
  },
  // Pass
  {
    id: "pass.quick",
    label: "Quick game",
    family: "pass_game",
    aliases: ["quick game", "slant", "stick", "mesh", "hitch"],
    side: "offense",
    blurb: "Rhythm / quick-game concepts.",
  },
  {
    id: "pass.four_verts",
    label: "Four verticals",
    family: "pass_game",
    aliases: ["four verticals", "four verts", "go ball", "vertical"],
    side: "offense",
    blurb: "Vertical stretch with four deep routes.",
  },
  {
    id: "pass.flood",
    label: "Flood concept",
    family: "pass_game",
    aliases: ["flood", "smash", "levels", "flood concept"],
    side: "offense",
    blurb: "High-low / three-level stretch.",
  },
  {
    id: "pass.screen",
    label: "Screen",
    family: "pass_game",
    aliases: ["screen", "bubble", "tunnel screen"],
    side: "offense",
    blurb: "Screen game.",
  },
  {
    id: "pass.boot",
    label: "Boot / waggle",
    family: "pass_game",
    aliases: ["boot", "nak", "waggle", "boot / waggle"],
    side: "offense",
    blurb: "Bootleg / waggle play-action.",
  },
  {
    id: "pass.est",
    label: "Pass concept (est.)",
    family: "pass_game",
    aliases: ["pass concept (est.)", "pass"],
    side: "offense",
    blurb: "Estimated pass family when vision is sparse.",
  },
  {
    id: "run.est",
    label: "Run concept (est.)",
    family: "run_game",
    aliases: ["run concept (est.)", "run"],
    side: "offense",
    blurb: "Estimated run family when vision is sparse.",
  },
  // RPO
  {
    id: "rpo.base",
    label: "RPO",
    family: "rpo",
    aliases: ["rpo", "glance", "rpo glance"],
    side: "offense",
    blurb: "Run-pass option family.",
  },
  // Defense
  {
    id: "cov.cover3",
    label: "Cover 3",
    family: "coverage",
    aliases: ["cover 3", "cover3", "cover 3 sky"],
    side: "defense",
    blurb: "Three-deep zone shell.",
  },
  {
    id: "cov.cover2",
    label: "Cover 2",
    family: "coverage",
    aliases: ["cover 2", "cover2", "tampa", "tampa 2"],
    side: "defense",
    blurb: "Two-deep zone / Tampa 2 family.",
  },
  {
    id: "cov.man",
    label: "Man coverage",
    family: "coverage",
    aliases: ["man", "man coverage", "press", "cover 1", "cover 0"],
    side: "defense",
    blurb: "Man-to-man shell.",
  },
  {
    id: "cov.base_est",
    label: "Base defense (est.)",
    family: "coverage",
    aliases: ["base defense (est.)"],
    side: "defense",
    blurb: "Fallback when coverage is unknown.",
  },
  {
    id: "pres.pressure",
    label: "Pressure",
    family: "pressure",
    aliases: ["pressure", "blitz", "edge pressure"],
    side: "defense",
    blurb: "Blitz / pressure call.",
  },
  // Special
  {
    id: "st.punt",
    label: "Punt",
    family: "special",
    aliases: ["punt", "punt formation"],
    side: "special",
    blurb: "Punt unit.",
  },
  {
    id: "st.fg",
    label: "Field goal",
    family: "special",
    aliases: ["field goal", "fg", "field goal unit"],
    side: "special",
    blurb: "FG / PAT unit.",
  },
  {
    id: "st.special",
    label: "Special teams",
    family: "special",
    aliases: ["special teams"],
    side: "special",
    blurb: "Generic special teams.",
  },
  // Situations / results (map AI situation tags)
  {
    id: "sit.3rd_long",
    label: "3rd & long",
    family: "situation",
    aliases: ["3rd & long", "3rd and long"],
    side: "any",
    blurb: "Third down, long yardage.",
  },
  {
    id: "sit.3rd_short",
    label: "3rd & short",
    family: "situation",
    aliases: ["3rd & short", "3rd and short"],
    side: "any",
    blurb: "Third down, short yardage.",
  },
  {
    id: "sit.4th",
    label: "4th down",
    family: "situation",
    aliases: ["4th down"],
    side: "any",
    blurb: "Fourth-down decision space.",
  },
  {
    id: "sit.red_zone",
    label: "Red zone",
    family: "situation",
    aliases: ["red zone"],
    side: "any",
    blurb: "Inside the 20.",
  },
  {
    id: "sit.goal_to_go",
    label: "Goal-to-go territory",
    family: "situation",
    aliases: ["goal-to-go territory", "goal to go"],
    side: "any",
    blurb: "Goal-to-go field position.",
  },
  {
    id: "res.td",
    label: "Touchdown",
    family: "result",
    aliases: ["touchdown", "td"],
    side: "any",
    blurb: "Score.",
  },
  {
    id: "res.explosive",
    label: "Explosive",
    family: "result",
    aliases: ["explosive"],
    side: "any",
    blurb: "Explosive gain threshold.",
  },
  {
    id: "res.turnover",
    label: "Turnover",
    family: "result",
    aliases: ["turnover"],
    side: "any",
    blurb: "Change of possession.",
  },
  {
    id: "res.tfl",
    label: "TFL / loss",
    family: "result",
    aliases: ["tfl / loss", "tfl", "loss"],
    side: "any",
    blurb: "Tackle for loss / negative play.",
  },
  {
    id: "res.no_gain",
    label: "No gain",
    family: "result",
    aliases: ["no gain"],
    side: "any",
    blurb: "Zero-yard play.",
  },
] as const;

const byId = new Map(PLAY_ONTOLOGY.map((e) => [e.id, e]));
const byAlias = new Map<string, OntologyEntry>();
for (const e of PLAY_ONTOLOGY) {
  byAlias.set(e.label.toLowerCase(), e);
  for (const a of e.aliases) byAlias.set(a.toLowerCase(), e);
}

export function getOntologyEntry(id: string): OntologyEntry | undefined {
  return byId.get(id);
}

export function normalizeLabelToOntology(label: string): OntologyEntry | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  return byAlias.get(key) ?? null;
}

export function mapPlayTagsToOntology(
  tags: Array<{ label: string; category?: string }>,
): Array<{ tagLabel: string; entry: OntologyEntry }> {
  const out: Array<{ tagLabel: string; entry: OntologyEntry }> = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const entry = normalizeLabelToOntology(t.label);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({ tagLabel: t.label, entry });
  }
  return out;
}

export function ontologyByFamily(
  family: OntologyFamily,
): OntologyEntry[] {
  return PLAY_ONTOLOGY.filter((e) => e.family === family);
}

export function listOntologyFamilies(): OntologyFamily[] {
  return Array.from(new Set(PLAY_ONTOLOGY.map((e) => e.family)));
}

/** Count plays that hit each ontology id (via tag labels). */
export function countOntologyHits(
  plays: Array<{ tags: Array<{ label: string }> }>,
): Array<{ id: string; label: string; family: OntologyFamily; count: number }> {
  const counts = new Map<string, number>();
  for (const p of plays) {
    const mapped = mapPlayTagsToOntology(p.tags);
    const uniq = new Set(mapped.map((m) => m.entry.id));
    for (const id of uniq) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => {
      const e = byId.get(id)!;
      return { id, label: e.label, family: e.family, count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
