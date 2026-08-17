import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mintShareToken, normalizeShareSnapshot } from "./share-validate";

describe("normalizeShareSnapshot", () => {
  it("accepts a minimal valid payload and assigns token", () => {
    const snap = normalizeShareSnapshot(
      {
        version: 1,
        title: "3rd down",
        description: "teach",
        plays: [
          {
            id: "p1",
            filmTitle: "W1",
            opponent: "Hawks",
            index: 1,
            side: "offense",
            quarter: 1,
            clock: "12:00",
            startSec: 0,
            endSec: 5,
            tags: [{ category: "concept", label: "Mesh", source: "coach" }],
          },
        ],
      },
      "sh_server_token",
    );
    assert.ok(snap);
    assert.equal(snap!.token, "sh_server_token");
    assert.equal(snap!.plays.length, 1);
  });

  it("rejects empty title and empty plays", () => {
    assert.equal(
      normalizeShareSnapshot({ version: 1, title: "", plays: [] }, "t"),
      null,
    );
  });

  it("clamps notes and drops bad tags", () => {
    const longNotes = "x".repeat(2000);
    const snap = normalizeShareSnapshot(
      {
        version: 1,
        title: "T",
        plays: [
          {
            id: "p1",
            side: "offense",
            notes: longNotes,
            tags: [
              { category: "concept", label: "Ok", source: "ai" },
              { category: "nope", label: "Bad", source: "ai" },
            ],
          },
        ],
      },
      "sh_t",
    );
    assert.ok(snap);
    assert.ok((snap!.plays[0]!.notes?.length ?? 0) <= 500);
    assert.equal(snap!.plays[0]!.tags.length, 1);
  });
});

describe("mintShareToken", () => {
  it("returns high-entropy sh_ tokens", () => {
    const a = mintShareToken();
    const b = mintShareToken();
    assert.match(a, /^sh_/);
    assert.ok(a.length >= 20);
    assert.notEqual(a, b);
  });
});
