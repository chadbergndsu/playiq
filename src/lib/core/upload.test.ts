import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUploadedFilm, finalizeUploadedFilm } from "./upload";

describe("createUploadedFilm", () => {
  it("creates processing film with plays and AI tags", () => {
    const { film, plays } = createUploadedFilm({
      opponent: "Northview",
      week: 9,
      fileName: "week9.mp4",
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
    assert.equal(film.opponent, "Northview");
    assert.equal(film.week, 9);
    assert.equal(film.status, "processing");
    assert.equal(film.isUpload, true);
    assert.equal(film.sourceFileName, "week9.mp4");
    assert.equal(plays.length, 12);
    assert.ok(plays.every((p) => p.filmId === film.id));
    assert.ok(plays.some((p) => p.tags.length > 0));
  });

  it("finalize sets needs_review", () => {
    const { film } = createUploadedFilm({ opponent: "A", week: 1 });
    const ready = finalizeUploadedFilm(film);
    assert.equal(ready.status, "needs_review");
    assert.equal(ready.aiProgress, 100);
  });
});
