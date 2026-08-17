import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSchoolCode,
  schoolCodeConfigured,
  schoolCodesMatch,
  schoolProfileFromEnv,
} from "./school";

describe("school codes", () => {
  it("normalizes codes", () => {
    assert.equal(normalizeSchoolCode("  abc-12  "), "ABC-12");
    assert.equal(schoolCodeConfigured("ab"), false);
    assert.equal(schoolCodeConfigured("ABCD"), true);
  });

  it("matches case-insensitively", () => {
    assert.equal(schoolCodesMatch("demo-2026", "Demo-2026"), true);
    assert.equal(schoolCodesMatch("demo-2026", "other"), false);
  });

  it("builds display profile without student data", () => {
    assert.deepEqual(schoolProfileFromEnv({}), {
      name: "PlayIQ School",
      seasonLabel: "Film room",
    });
    assert.equal(
      schoolProfileFromEnv({ name: "Northside HS", seasonLabel: "2026 Varsity" }).name,
      "Northside HS",
    );
  });
});
