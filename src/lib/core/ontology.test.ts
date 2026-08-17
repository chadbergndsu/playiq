import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countOntologyHits,
  mapPlayTagsToOntology,
  normalizeLabelToOntology,
  PLAY_ONTOLOGY,
} from "./ontology";

describe("open play ontology", () => {
  it("has stable ids and aliases", () => {
    assert.ok(PLAY_ONTOLOGY.length >= 20);
    assert.ok(normalizeLabelToOntology("Inside zone")?.id === "run.inside_zone");
    assert.ok(normalizeLabelToOntology("IZ")?.id === "run.inside_zone");
    assert.ok(normalizeLabelToOntology("cover 3")?.id === "cov.cover3");
  });

  it("maps play tags without duplicates", () => {
    const mapped = mapPlayTagsToOntology([
      { label: "Shotgun" },
      { label: "sg" },
      { label: "Inside zone" },
      { label: "Unknown Foo" },
    ]);
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0]!.entry.id, "form.shotgun");
  });

  it("counts ontology hits across plays", () => {
    const counts = countOntologyHits([
      { tags: [{ label: "Shotgun" }, { label: "Inside zone" }] },
      { tags: [{ label: "Shotgun" }, { label: "Power" }] },
    ]);
    const shotgun = counts.find((c) => c.id === "form.shotgun");
    assert.equal(shotgun?.count, 2);
  });
});
