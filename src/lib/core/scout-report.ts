/**
 * Self-scout / opponent tendency report — pure text for download or print.
 * Coaches ship this to the install meeting without proprietary export lock-in.
 */

import {
  countByTagCategory,
  downDistanceMatrix,
  explosiveRate,
  thirdDownConversion,
} from "./tendencies";
import type { Film, Play } from "./types";

export type ScoutReportOptions = {
  title?: string;
  /** When set, filter plays to films vs this opponent (case-insensitive). */
  opponent?: string;
  /** ISO date for header; defaults to now. */
  generatedAt?: string;
  season?: string;
};

export type ScoutReportSection = {
  heading: string;
  lines: string[];
};

export type ScoutReport = {
  title: string;
  subtitle: string;
  generatedAt: string;
  playCount: number;
  filmCount: number;
  sections: ScoutReportSection[];
};

function pct(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

function filterPlays(
  films: Film[],
  plays: Play[],
  opponent?: string,
): { films: Film[]; plays: Play[] } {
  if (!opponent?.trim()) return { films, plays };
  const q = opponent.trim().toLowerCase();
  const filmIds = new Set(
    films.filter((f) => f.opponent.toLowerCase().includes(q)).map((f) => f.id),
  );
  return {
    films: films.filter((f) => filmIds.has(f.id)),
    plays: plays.filter((p) => filmIds.has(p.filmId)),
  };
}

/** Build structured scout report from tagged film. */
export function buildScoutReport(
  films: Film[],
  plays: Play[],
  options: ScoutReportOptions = {},
): ScoutReport {
  const filtered = filterPlays(films, plays, options.opponent);
  const f = filtered.films;
  const p = filtered.plays;
  const offense = p.filter((x) => x.side === "offense");
  const defense = p.filter((x) => x.side === "defense");
  const third = thirdDownConversion(p);
  const explosive = explosiveRate(p);
  const formations = countByTagCategory(offense, "formation", 8);
  const concepts = countByTagCategory(offense, "concept", 10);
  const defFronts = countByTagCategory(defense, "formation", 6);
  const defConcepts = countByTagCategory(defense, "concept", 6);
  const personnel = countByTagCategory(offense, "personnel", 6);
  const matrix = downDistanceMatrix(p, "offense");
  const starred = p.filter((x) => x.starred);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const oppLabel = options.opponent?.trim() || "All opponents";
  const season = options.season ?? f[0]?.season ?? "Season";
  const title =
    options.title ??
    (options.opponent?.trim()
      ? `Scout report — vs ${options.opponent.trim()}`
      : "Self-scout report");

  const sections: ScoutReportSection[] = [
    {
      heading: "Snapshot",
      lines: [
        `Films: ${f.length}`,
        `Plays: ${p.length} (${offense.length} offense / ${defense.length} defense / ${p.length - offense.length - defense.length} other)`,
        `3rd down conversion (off): ${pct(third.rate)} (${third.conversions}/${third.attempts})`,
        `Explosive rate (off): ${pct(explosive.rate)} (${explosive.explosive}/${explosive.total})`,
        `Starred install clips: ${starred.length}`,
      ],
    },
    {
      heading: "Offensive formations",
      lines:
        formations.length === 0
          ? ["(no formation tags)"]
          : formations.map((x) => `${x.label}: ${x.count}`),
    },
    {
      heading: "Offensive concepts",
      lines:
        concepts.length === 0
          ? ["(no concept tags)"]
          : concepts.map((x) => `${x.label}: ${x.count}`),
    },
    {
      heading: "Personnel",
      lines:
        personnel.length === 0
          ? ["(no personnel tags)"]
          : personnel.map((x) => `${x.label}: ${x.count}`),
    },
    {
      heading: "Down × distance (offense)",
      lines:
        matrix.length === 0
          ? ["(no down/distance data)"]
          : matrix.map(
              (b) =>
                `${b.down} & ${b.distanceBand}: n=${b.count}${b.avgYards != null ? `, avg ${b.avgYards} yds` : ""}`,
            ),
    },
    {
      heading: "Defensive looks seen",
      lines:
        defFronts.length === 0 && defConcepts.length === 0
          ? ["(no defensive tags)"]
          : [
              ...defFronts.map((x) => `Front/look ${x.label}: ${x.count}`),
              ...defConcepts.map((x) => `Coverage/concept ${x.label}: ${x.count}`),
            ],
    },
    {
      heading: "Install bookmarks (starred)",
      lines:
        starred.length === 0
          ? ["(none starred)"]
          : starred.slice(0, 25).map((play) => {
              const film = f.find((x) => x.id === play.filmId);
              const concept =
                play.tags.find((t) => t.category === "concept")?.label ?? "—";
              const sit =
                play.down != null
                  ? `${play.down}&${play.distance ?? "?"}`
                  : play.side;
              return `Play ${play.index} · ${film?.title ?? play.filmId} · ${sit} · ${concept}${play.notes ? ` — ${play.notes}` : ""}`;
            }),
    },
    {
      heading: "Film list",
      lines:
        f.length === 0
          ? ["(no films)"]
          : f
              .slice()
              .sort((a, b) => a.week - b.week)
              .map(
                (film) =>
                  `W${film.week} ${film.title} (${film.date}, ${film.venue}) — ${film.playCount} plays`,
              ),
    },
  ];

  return {
    title,
    subtitle: `${season} · ${oppLabel}`,
    generatedAt,
    playCount: p.length,
    filmCount: f.length,
    sections,
  };
}

/** Markdown suitable for Notes / Google Docs / GitHub. */
export function scoutReportToMarkdown(report: ScoutReport): string {
  const lines: string[] = [
    `# ${report.title}`,
    "",
    `_${report.subtitle}_`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
  ];
  for (const section of report.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const line of section.lines) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }
  lines.push("---", "", "_PlayIQ open scout report — portable, no vendor lock-in._", "");
  return lines.join("\n");
}

/** Minimal HTML for browser print / PDF. */
export function scoutReportToHtml(report: ScoutReport): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const body = report.sections
    .map(
      (sec) => `
    <section>
      <h2>${esc(sec.heading)}</h2>
      <ul>
        ${sec.lines.map((l) => `<li>${esc(l)}</li>`).join("\n        ")}
      </ul>
    </section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(report.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #111; line-height: 1.45; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .meta { color: #555; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    ul { padding-left: 1.25rem; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>${esc(report.title)}</h1>
  <p class="meta">${esc(report.subtitle)} · Generated ${esc(report.generatedAt)}</p>
  ${body}
  <p class="meta" style="margin-top:2rem">PlayIQ open scout report</p>
</body>
</html>
`;
}
