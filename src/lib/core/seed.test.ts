import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupFilmsForLibrary,
  playableScheduleGames,
  seedFilms,
  seedProductDemoFilms,
} from "./seed";
import { TEAM_SCHEDULE } from "./schedule";

describe("public seed", () => {
  it("seeds an empty school library by default", () => {
    const films = seedFilms();
    assert.equal(films.length, 0);
    assert.deepEqual(playableScheduleGames(TEAM_SCHEDULE), []);
  });

  it("keeps product demo behind a separate seed", () => {
    const demo = seedProductDemoFilms();
    assert.ok(demo.length >= 6);
    assert.ok(demo.every((f) => f.level === "varsity"));
    assert.ok(demo.every((f) => f.id.startsWith("film_demo_")));
  });

  it("groups product demo films", () => {
    const groups = groupFilmsForLibrary(seedProductDemoFilms());
    assert.ok(groups.some((g) => g.id === "demo"));
  });
});
