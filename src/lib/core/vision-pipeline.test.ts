import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  segmentFromFrameStats,
  segmentsToPlays,
  syntheticFrameStats,
  visionResultToOfp,
} from "./vision-pipeline";

describe("vision pipeline", () => {
  it("segments synthetic stats into multiple plays", () => {
    const frames = syntheticFrameStats(120, 2);
    const segs = segmentFromFrameStats(frames, { durationSec: 120 });
    assert.ok(segs.length >= 4);
    assert.equal(segs[0]!.startSec, 0);
    assert.ok(segs[segs.length - 1]!.endSec <= 120.01);
  });

  it("builds tagged plays and OFP", () => {
    const frames = syntheticFrameStats(60, 1);
    const segs = segmentFromFrameStats(frames, { durationSec: 60 });
    const plays = segmentsToPlays("film_v", segs);
    assert.ok(plays.every((p) => p.tags.length > 0));
    const { package: pkg } = visionResultToOfp({
      film: {
        id: "film_v",
        title: "vs Vision",
        opponent: "Vision",
        week: 1,
        season: "2026",
        date: "2026-08-03",
        venue: "home",
        level: "varsity",
        durationSec: 60,
        status: "needs_review",
        sourceFileName: "game.mp4",
      },
      frames,
      seed: 1,
    });
    assert.equal(pkg.format, "playiq.open-film-package");
    assert.ok(pkg.plays.length >= 2);
    assert.equal(pkg.generator, "PlayIQ local-vision-sidecar");
  });

  it("honest youth split invents no downs or yards", () => {
    const frames = syntheticFrameStats(60, 1);
    const { plays, package: pkg } = visionResultToOfp({
      film: {
        id: "film_honest",
        title: "vs Westfield",
        opponent: "Westfield",
        week: 1,
        season: "2026",
        date: "2026-08-22",
        venue: "home",
        level: "youth",
        durationSec: 60,
        status: "needs_review",
        sourceFileName: "week1-game.mp4",
      },
      frames,
      seed: 1,
      honest: true,
    });
    assert.ok(plays.length >= 2);
    assert.ok(plays.every((p) => p.down === undefined && p.yardsGained === undefined));
    assert.ok(plays.every((p) => p.tags.length === 0));
    assert.equal(pkg.generator, "PlayIQ local-vision-honest");
  });
});
