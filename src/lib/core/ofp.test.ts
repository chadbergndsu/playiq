import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOpenFilmPackage,
  mergeOfpIntoLibrary,
  parseOfp,
  serializeOfp,
} from "./ofp";
import type { Film, Play } from "./types";

const film: Film = {
  id: "film_x",
  title: "vs Test",
  opponent: "Test",
  week: 2,
  season: "2025",
  date: "2025-09-08",
  venue: "home",
  level: "varsity",
  durationSec: 1000,
  status: "ready",
  aiProgress: 100,
  playCount: 1,
  tagCount: 1,
  thumbnailHue: 200,
  createdAt: "2025-09-08T00:00:00.000Z",
};

const play: Play = {
  id: "film_x_p1",
  filmId: "film_x",
  index: 1,
  startSec: 10,
  endSec: 18,
  quarter: 1,
  clock: "12:00",
  side: "offense",
  down: 1,
  distance: 10,
  tags: [
    { id: "1", category: "formation", label: "Shotgun", source: "ai", confidence: 0.8 },
    { id: "2", category: "concept", label: "Inside zone", source: "coach" },
  ],
};

describe("Open Film Package", () => {
  it("round-trips serialize/parse with ontology ids", () => {
    const pkg = buildOpenFilmPackage({
      films: [film],
      plays: [play],
      now: new Date("2026-08-03T00:00:00.000Z"),
    });
    assert.equal(pkg.format, "playiq.open-film-package");
    const shotgun = pkg.plays[0]!.tags.find((t) => t.label === "Shotgun");
    assert.equal(shotgun?.ontologyId, "form.shotgun");
    const raw = serializeOfp(pkg);
    const again = parseOfp(raw);
    assert.equal(again.plays.length, 1);
    assert.equal(again.films[0]!.opponent, "Test");
  });

  it("rejects non-OFP JSON", () => {
    assert.throws(() => parseOfp('{"films":[]}'), /Open Film Package/);
  });

  it("merges import into empty library", () => {
    const pkg = buildOpenFilmPackage({ films: [film], plays: [play] });
    const merged = mergeOfpIntoLibrary(
      { films: [], playsByFilm: {} },
      pkg,
    );
    assert.equal(merged.importedFilms, 1);
    assert.equal(merged.importedPlays, 1);
    assert.equal(merged.playsByFilm.film_x?.length, 1);
  });
});
