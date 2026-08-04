import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dotsForLabel, renderFormationSvg } from "./formation-svg";

describe("formation SVG", () => {
  it("places offense dots for shotgun / trips", () => {
    assert.ok(dotsForLabel("Shotgun").some((d) => d.role === "QB"));
    assert.ok(dotsForLabel("Trips").length >= 8);
  });

  it("renders valid svg markup", () => {
    const svg = renderFormationSvg({ label: "Cover 3" });
    assert.match(svg, /^<svg /);
    assert.match(svg, /Cover 3/);
    assert.match(svg, /<\/svg>$/);
  });
});
