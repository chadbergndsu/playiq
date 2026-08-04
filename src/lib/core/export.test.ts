import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCutupShareSnapshot,
  exportCutupCsv,
  exportCutupJson,
  newShareToken,
} from "./export";
import type { Cutup, Film, Play } from "./types";

const film: Film = {
  id: "film_1",
  title: "vs Westfield",
  opponent: "Westfield",
  week: 1,
  season: "2025",
  date: "2025-09-01",
  venue: "home",
  level: "varsity",
  durationSec: 5400,
  status: "ready",
  aiProgress: 100,
  playCount: 1,
  tagCount: 1,
  thumbnailHue: 210,
  createdAt: "2025-09-01T00:00:00.000Z",
};

const play: Play = {
  id: "film_1_p1",
  filmId: "film_1",
  index: 1,
  startSec: 10,
  endSec: 18,
  quarter: 1,
  clock: "12:00",
  side: "offense",
  down: 3,
  distance: 8,
  yardLine: 40,
  yardsGained: 12,
  tags: [
    { id: "a", category: "concept", label: "Inside zone", source: "ai" },
    { id: "b", category: "formation", label: "Shotgun", source: "ai" },
  ],
  notes: 'Call "Ricochet"',
};

const cutup: Cutup = {
  id: "cut_1",
  title: "3rd down",
  description: "Teach",
  playIds: ["film_1_p1"],
  filterSummary: "offense · Down 3",
  createdAt: "2025-09-01T00:00:00.000Z",
  updatedAt: "2025-09-01T00:00:00.000Z",
};

describe("export cutup", () => {
  it("builds ordered share snapshot", () => {
    const snap = buildCutupShareSnapshot({
      token: "sh_test",
      cutup,
      plays: [play],
      films: [film],
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
    assert.equal(snap.version, 1);
    assert.equal(snap.plays.length, 1);
    assert.equal(snap.plays[0]!.opponent, "Westfield");
    assert.equal(snap.plays[0]!.tags[0]!.label, "Inside zone");
  });

  it("exports CSV with escaped notes", () => {
    const snap = buildCutupShareSnapshot({
      token: "sh_test",
      cutup,
      plays: [play],
      films: [film],
    });
    const csv = exportCutupCsv(snap);
    assert.match(csv, /play_index,film,opponent/);
    assert.match(csv, /Inside zone/);
    assert.match(csv, /"Call ""Ricochet"""/);
  });

  it("exports valid JSON", () => {
    const snap = buildCutupShareSnapshot({
      token: "sh_test",
      cutup,
      plays: [play],
      films: [film],
    });
    const parsed = JSON.parse(exportCutupJson(snap)) as { title: string };
    assert.equal(parsed.title, "3rd down");
  });

  it("creates CSPRNG share tokens", () => {
    const t = newShareToken();
    assert.match(t, /^sh_/);
    assert.ok(t.length >= 20);
    assert.notEqual(newShareToken(), newShareToken());
  });

  it("neutralizes CSV formula cells", () => {
    const snap = buildCutupShareSnapshot({
      token: "sh_test",
      cutup: {
        id: "c1",
        title: "t",
        description: "",
        playIds: ["p1"],
        filterSummary: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      plays: [
        {
          id: "p1",
          filmId: "f1",
          index: 1,
          startSec: 0,
          endSec: 5,
          quarter: 1,
          clock: "12:00",
          side: "offense",
          notes: "=HYPERLINK(\"http://evil\")",
          tags: [],
        },
      ],
      films: [
        {
          id: "f1",
          title: "Film",
          opponent: "X",
          week: 1,
          season: "2025",
          date: "2025-01-01",
          venue: "home",
          level: "varsity",
          durationSec: 10,
          status: "ready",
          aiProgress: 100,
          playCount: 1,
          tagCount: 0,
          thumbnailHue: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const csv = exportCutupCsv(snap);
    assert.ok(csv.includes("'=HYPERLINK"));
  });
});
