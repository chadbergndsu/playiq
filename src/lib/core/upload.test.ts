import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUploadedFilm, finalizeUploadedFilm } from "./upload";

describe("createUploadedFilm", () => {
  it("creates a single honest play with no invented downs or yards", () => {
    const { film, plays } = createUploadedFilm({
      opponent: "Westfield",
      week: 1,
      fileName: "sideline-01.mp4",
      durationSec: 7.4,
      now: new Date("2026-08-22T16:00:00.000Z"),
    });
    assert.equal(film.opponent, "Westfield");
    assert.equal(film.week, 1);
    assert.equal(film.level, "youth");
    assert.equal(film.status, "processing");
    assert.equal(film.isUpload, true);
    assert.equal(film.sourceFileName, "sideline-01.mp4");
    assert.equal(film.durationSec, 7.4);
    assert.equal(plays.length, 1);
    const play = plays[0]!;
    assert.equal(play.filmId, film.id);
    assert.equal(play.startSec, 0);
    assert.equal(play.endSec, 7.4);
    assert.equal(play.down, undefined);
    assert.equal(play.distance, undefined);
    assert.equal(play.yardsGained, undefined);
    assert.equal(play.yardLine, undefined);
    assert.equal(play.tags.length, 0);
    assert.ok(play.notes?.includes("confirm"));
  });

  it("creates an empty game shell for auto-split", () => {
    const { film, plays } = createUploadedFilm({
      opponent: "Westfield",
      week: 1,
      mode: "game",
      durationSec: 3600,
      now: new Date("2026-08-22T16:00:00.000Z"),
    });
    assert.equal(film.title, "vs Westfield");
    assert.equal(plays.length, 0);
    assert.equal(film.playCount, 0);
    assert.equal(film.status, "processing");
  });

  it("finalize sets needs_review without inventing AI progress story", () => {
    const { film } = createUploadedFilm({ opponent: "Union", week: 2 });
    const ready = finalizeUploadedFilm(film);
    assert.equal(ready.status, "needs_review");
    assert.equal(ready.aiProgress, 100);
  });
});
