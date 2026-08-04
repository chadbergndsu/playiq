import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCutup,
  buildCutupFromPlayIds,
  cutupDurationSec,
  filterPlays,
  groupPlaysBySide,
  starredInstallPlayIds,
  summarizeFilter,
  topConcepts,
} from "./cutups";
import type { Play, PlayFilter } from "./types";

const plays: Play[] = [
  {
    id: "p1",
    filmId: "f1",
    index: 1,
    startSec: 0,
    endSec: 10,
    quarter: 1,
    clock: "12:00",
    side: "offense",
    down: 3,
    distance: 8,
    tags: [
      { id: "t1", category: "concept", label: "Inside zone", source: "ai", confidence: 0.8 },
    ],
  },
  {
    id: "p2",
    filmId: "f1",
    index: 2,
    startSec: 12,
    endSec: 20,
    quarter: 1,
    clock: "11:40",
    side: "defense",
    down: 1,
    tags: [{ id: "t2", category: "concept", label: "Cover 3", source: "ai", confidence: 0.7 }],
  },
  {
    id: "p3",
    filmId: "f1",
    index: 3,
    startSec: 22,
    endSec: 30,
    quarter: 1,
    clock: "11:10",
    side: "offense",
    down: 3,
    distance: 2,
    tags: [
      { id: "t3", category: "concept", label: "Inside zone", source: "coach" },
    ],
    notes: "pull guard late",
  },
];

describe("filterPlays", () => {
  it("filters by side and down", () => {
    const filter: PlayFilter = {
      query: "",
      side: "offense",
      concept: "all",
      down: 3,
      source: "all",
    };
    const out = filterPlays(plays, filter);
    assert.equal(out.length, 2);
    assert.ok(out.every((p) => p.side === "offense" && p.down === 3));
  });

  it("filters by concept label", () => {
    const filter: PlayFilter = {
      query: "",
      side: "all",
      concept: "Inside zone",
      down: "all",
      source: "all",
    };
    assert.equal(filterPlays(plays, filter).length, 2);
  });

  it("filters by free-text notes", () => {
    const filter: PlayFilter = {
      query: "pull guard",
      side: "all",
      concept: "all",
      down: "all",
      source: "all",
    };
    assert.equal(filterPlays(plays, filter).length, 1);
    assert.equal(filterPlays(plays, filter)[0]!.id, "p3");
  });

  it("filters starred only", () => {
    const withStar: Play[] = [
      ...plays,
      { ...plays[0]!, id: "p1s", starred: true },
    ];
    const filter: PlayFilter = {
      query: "",
      side: "all",
      concept: "all",
      down: "all",
      source: "all",
      starredOnly: true,
    };
    assert.equal(filterPlays(withStar, filter).length, 1);
    assert.equal(filterPlays(withStar, filter)[0]!.id, "p1s");
  });
});

describe("buildCutup", () => {
  it("collects matching play ids", () => {
    const cut = buildCutup({
      id: "c1",
      title: "3rd down offense",
      plays,
      filter: {
        query: "",
        side: "offense",
        concept: "all",
        down: 3,
        source: "all",
      },
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    assert.equal(cut.playIds.length, 2);
    assert.equal(cut.filterSummary.includes("offense"), true);
    assert.equal(cut.createdAt, "2026-08-01T00:00:00.000Z");
  });

  it("builds from explicit play ids and starred install", () => {
    const cut = buildCutupFromPlayIds({
      id: "c2",
      title: "Install",
      playIds: ["p2", "p1"],
      filterSummary: "install",
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    assert.deepEqual(cut.playIds, ["p2", "p1"]);
    const withStar = plays.map((p) =>
      p.id === "p1" ? { ...p, starred: true } : p,
    );
    assert.deepEqual(starredInstallPlayIds(withStar), ["p1"]);
  });
});

describe("aggregates", () => {
  it("summarizes filter and duration", () => {
    assert.equal(
      summarizeFilter({
        query: "",
        side: "all",
        concept: "all",
        down: "all",
        source: "all",
      }),
      "All plays",
    );
    assert.equal(cutupDurationSec(plays, ["p1", "p2"]), 18);
    assert.deepEqual(groupPlaysBySide(plays), { offense: 2, defense: 1, special: 0 });
    assert.equal(topConcepts(plays, 1)[0]!.label, "Inside zone");
  });
});
