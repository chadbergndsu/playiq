import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceTeachQueue,
  buildTeachQueue,
  clampQueueIndex,
  teachQueueDurationSec,
} from "./teach-queue";
import type { Film, Play } from "./types";

const film: Film = {
  id: "f1",
  title: "vs Hawks",
  opponent: "Hawks",
  week: 1,
  season: "2025",
  date: "2025-09-01",
  venue: "home",
  level: "varsity",
  durationSec: 300,
  status: "ready",
  aiProgress: 100,
  playCount: 2,
  tagCount: 1,
  thumbnailHue: 120,
  createdAt: "2025-09-01T00:00:00.000Z",
};

function play(partial: Partial<Play> & { id: string; index: number }): Play {
  return {
    filmId: "f1",
    startSec: partial.startSec ?? 0,
    endSec: partial.endSec ?? 10,
    quarter: 1,
    clock: "12:00",
    side: "offense",
    tags: partial.tags ?? [],
    ...partial,
  };
}

describe("buildTeachQueue", () => {
  it("orders by playIds and skips missing", () => {
    const plays = [
      play({ id: "a", index: 1, startSec: 0, endSec: 5 }),
      play({ id: "b", index: 2, startSec: 10, endSec: 20 }),
    ];
    const q = buildTeachQueue({
      playIds: ["b", "missing", "a"],
      plays,
      films: [film],
    });
    assert.equal(q.length, 2);
    assert.equal(q[0]!.play.id, "b");
    assert.equal(q[0]!.queueIndex, 0);
    assert.equal(q[1]!.play.id, "a");
    assert.equal(q[0]!.filmTitle, "vs Hawks");
    assert.ok(q[0]!.label.includes("Clip 1"));
  });

  it("sums clip durations", () => {
    const plays = [
      play({ id: "a", index: 1, startSec: 0, endSec: 5 }),
      play({ id: "b", index: 2, startSec: 10, endSec: 25 }),
    ];
    const q = buildTeachQueue({ playIds: ["a", "b"], plays, films: [film] });
    assert.equal(teachQueueDurationSec(q), 20);
  });
});

describe("advanceTeachQueue", () => {
  it("stops when autoAdvance is off", () => {
    assert.deepEqual(
      advanceTeachQueue({
        queueIndex: 0,
        queueLength: 3,
        autoAdvance: false,
        loop: true,
      }),
      { kind: "end" },
    );
  });

  it("moves to next clip", () => {
    assert.deepEqual(
      advanceTeachQueue({
        queueIndex: 0,
        queueLength: 3,
        autoAdvance: true,
        loop: false,
      }),
      { kind: "clip", queueIndex: 1 },
    );
  });

  it("ends on last without loop", () => {
    assert.deepEqual(
      advanceTeachQueue({
        queueIndex: 2,
        queueLength: 3,
        autoAdvance: true,
        loop: false,
      }),
      { kind: "end" },
    );
  });

  it("loops to zero on last with loop", () => {
    assert.deepEqual(
      advanceTeachQueue({
        queueIndex: 2,
        queueLength: 3,
        autoAdvance: true,
        loop: true,
      }),
      { kind: "loop", queueIndex: 0 },
    );
  });
});

describe("clampQueueIndex", () => {
  it("clamps", () => {
    assert.equal(clampQueueIndex(-1, 5), 0);
    assert.equal(clampQueueIndex(99, 5), 4);
    assert.equal(clampQueueIndex(2, 0), 0);
  });
});
