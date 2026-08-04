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

  it("creates share tokens", () => {
    const t = newShareToken(1);
    assert.match(t, /^sh_/);
  });
});
