import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScoutReport,
  scoutReportToHtml,
  scoutReportToMarkdown,
} from "./scout-report";
import type { Film, Play } from "./types";

const films: Film[] = [
  {
    id: "f1",
    title: "Week 1 vs Hawks",
    opponent: "Hawks",
    week: 1,
    season: "2025",
    date: "2025-09-05",
    venue: "home",
    level: "varsity",
    durationSec: 100,
    status: "ready",
    aiProgress: 100,
    playCount: 2,
    tagCount: 3,
    thumbnailHue: 100,
    createdAt: "2025-09-05T00:00:00.000Z",
  },
  {
    id: "f2",
    title: "Week 2 vs Eagles",
    opponent: "Eagles",
    week: 2,
    season: "2025",
    date: "2025-09-12",
    venue: "away",
    level: "varsity",
    durationSec: 100,
    status: "ready",
    aiProgress: 100,
    playCount: 1,
    tagCount: 1,
    thumbnailHue: 200,
    createdAt: "2025-09-12T00:00:00.000Z",
  },
];

const plays: Play[] = [
  {
    id: "p1",
    filmId: "f1",
    index: 1,
    startSec: 0,
    endSec: 8,
    quarter: 1,
    clock: "12:00",
    down: 3,
    distance: 7,
    side: "offense",
    yardsGained: 12,
    starred: true,
    tags: [
      { id: "t1", category: "formation", label: "Trips", source: "ai" },
      { id: "t2", category: "concept", label: "Mesh", source: "coach" },
    ],
  },
  {
    id: "p2",
    filmId: "f1",
    index: 2,
    startSec: 10,
    endSec: 18,
    quarter: 1,
    clock: "11:00",
    down: 1,
    distance: 10,
    side: "defense",
    tags: [{ id: "t3", category: "formation", label: "Nickel", source: "ai" }],
  },
  {
    id: "p3",
    filmId: "f2",
    index: 1,
    startSec: 0,
    endSec: 6,
    quarter: 2,
    clock: "5:00",
    down: 3,
    distance: 2,
    side: "offense",
    yardsGained: 5,
    tags: [{ id: "t4", category: "concept", label: "Power", source: "ai" }],
  },
];

describe("buildScoutReport", () => {
  it("aggregates all films", () => {
    const r = buildScoutReport(films, plays, {
      generatedAt: "2026-08-04T12:00:00.000Z",
    });
    assert.equal(r.filmCount, 2);
    assert.equal(r.playCount, 3);
    assert.ok(r.title.toLowerCase().includes("self-scout"));
    const install = r.sections.find((s) => s.heading.includes("Install"));
    assert.ok(install?.lines.some((l) => l.includes("Play 1")));
  });

  it("filters by opponent", () => {
    const r = buildScoutReport(films, plays, { opponent: "Hawks" });
    assert.equal(r.filmCount, 1);
    assert.equal(r.playCount, 2);
    assert.ok(r.title.includes("Hawks"));
  });
});

describe("scout report formats", () => {
  it("renders markdown with sections", () => {
    const r = buildScoutReport(films, plays, {
      generatedAt: "2026-08-04T12:00:00.000Z",
    });
    const md = scoutReportToMarkdown(r);
    assert.ok(md.includes("# "));
    assert.ok(md.includes("## Snapshot"));
    assert.ok(md.includes("Mesh"));
  });

  it("renders html and escapes", () => {
    const dirty: Play = {
      ...plays[0]!,
      notes: '<script>alert(1)</script>',
      tags: [
        {
          id: "x",
          category: "concept",
          label: "A < B",
          source: "coach",
        },
      ],
      starred: true,
    };
    const r = buildScoutReport(films, [dirty], {
      generatedAt: "2026-08-04T12:00:00.000Z",
    });
    const html = scoutReportToHtml(r);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(!html.includes("<script>alert"));
    assert.ok(html.includes("&lt;script&gt;") || html.includes("A &lt; B"));
  });
});
