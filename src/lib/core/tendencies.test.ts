import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countByTagCategory,
  downDistanceMatrix,
  explosiveRate,
  thirdDownConversion,
} from "./tendencies";
import type { Play } from "./types";

function p(over: Partial<Play> & Pick<Play, "id">): Play {
  return {
    filmId: "f",
    index: 1,
    startSec: 0,
    endSec: 5,
    quarter: 1,
    clock: "1:00",
    side: "offense",
    tags: [],
    ...over,
  };
}

describe("tendencies", () => {
  it("counts formations", () => {
    const plays = [
      p({
        id: "1",
        tags: [{ id: "a", category: "formation", label: "Shotgun", source: "ai" }],
      }),
      p({
        id: "2",
        tags: [{ id: "b", category: "formation", label: "Shotgun", source: "ai" }],
      }),
      p({
        id: "3",
        tags: [{ id: "c", category: "formation", label: "Pistol", source: "coach" }],
      }),
    ];
    const top = countByTagCategory(plays, "formation", 5);
    assert.equal(top[0]!.label, "Shotgun");
    assert.equal(top[0]!.count, 2);
  });

  it("computes 3rd down conversion proxy", () => {
    const plays = [
      p({ id: "1", down: 3, distance: 4, yardsGained: 5 }),
      p({ id: "2", down: 3, distance: 8, yardsGained: 2 }),
      p({ id: "3", down: 1, distance: 10, yardsGained: 20 }),
    ];
    const r = thirdDownConversion(plays);
    assert.equal(r.attempts, 2);
    assert.equal(r.conversions, 1);
    assert.equal(r.rate, 50);
  });

  it("builds down-distance matrix", () => {
    const plays = [
      p({ id: "1", down: 1, distance: 10, yardsGained: 4 }),
      p({ id: "2", down: 1, distance: 10, yardsGained: 6 }),
      p({ id: "3", down: 3, distance: 2, yardsGained: 1 }),
    ];
    const m = downDistanceMatrix(plays, "offense");
    const firstLong = m.find((b) => b.down === 1 && b.distanceBand === "long");
    assert.ok(firstLong);
    assert.equal(firstLong!.count, 2);
    assert.equal(firstLong!.avgYards, 5);
  });

  it("explosive rate", () => {
    const plays = [
      p({ id: "1", yardsGained: 20 }),
      p({ id: "2", yardsGained: 3 }),
      p({ id: "3", side: "defense", yardsGained: 30 }),
    ];
    const r = explosiveRate(plays);
    assert.equal(r.total, 2);
    assert.equal(r.explosive, 1);
    assert.equal(r.rate, 50);
  });
});
