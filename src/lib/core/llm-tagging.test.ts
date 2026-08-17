import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTagPrompt,
  chunkTagRequests,
  extractJsonFromLlmText,
  fillMissingWithHeuristics,
  normalizeLlmTag,
  parseLlmPlayTags,
  playToSignal,
  resultsToTagMap,
  tagPlaysHeuristic,
  visionHintFromPlay,
} from "./llm-tagging";
import { mergeTags } from "./tagging";
import type { Play, PlayTag } from "./types";

function samplePlay(over: Partial<Play> = {}): Play {
  return {
    id: "film_1_p1",
    filmId: "film_1",
    index: 1,
    startSec: 0,
    endSec: 8,
    quarter: 1,
    clock: "12:00",
    side: "offense",
    down: 1,
    distance: 10,
    yardLine: 35,
    yardsGained: 6,
    tags: [],
    ...over,
  };
}

describe("visionHintFromPlay / playToSignal", () => {
  it("prefers coach notes over tags", () => {
    const play = samplePlay({
      notes: "Trips open — inside zone left",
      tags: [{ id: "a", category: "concept", label: "Power", source: "coach" }],
    });
    assert.equal(visionHintFromPlay(play), "Trips open — inside zone left");
  });

  it("falls back to tag labels then side", () => {
    const withTags = samplePlay({
      tags: [{ id: "a", category: "formation", label: "Shotgun", source: "ai" }],
    });
    assert.match(visionHintFromPlay(withTags), /Shotgun/);
    const bare = samplePlay({ tags: [] });
    assert.equal(visionHintFromPlay(bare), "offense play");
  });

  it("maps play fields into a RawPlaySignal", () => {
    const play = samplePlay({ result: "touchdown", yardsGained: 28 });
    const signal = playToSignal(play, "shotgun four verticals");
    assert.equal(signal.side, "offense");
    assert.equal(signal.visionHint, "shotgun four verticals");
    assert.equal(signal.isScore, true);
    assert.equal(signal.isExplosive, true);
  });
});

describe("chunkTagRequests", () => {
  it("splits into fixed-size batches", () => {
    const reqs = Array.from({ length: 23 }, (_, i) => ({
      playId: `p${i}`,
      signal: { side: "offense" as const },
    }));
    const batches = chunkTagRequests(reqs, 10);
    assert.equal(batches.length, 3);
    assert.equal(batches[0]!.length, 10);
    assert.equal(batches[2]!.length, 3);
  });
});

describe("buildTagPrompt", () => {
  it("includes play ids and JSON instructions", () => {
    const { system, user } = buildTagPrompt([
      {
        playId: "p1",
        signal: {
          side: "offense",
          down: 3,
          distance: 12,
          visionHint: "shotgun stick",
        },
      },
    ]);
    assert.match(system, /valid JSON/i);
    assert.match(user, /"playId": "p1"/);
    assert.match(user, /shotgun stick/);
  });
});

describe("extractJsonFromLlmText", () => {
  it("parses raw JSON", () => {
    const data = extractJsonFromLlmText('{"plays":[]}');
    assert.deepEqual(data, { plays: [] });
  });

  it("parses fenced JSON", () => {
    const data = extractJsonFromLlmText('```json\n{"plays":[{"playId":"x"}]}\n```');
    assert.deepEqual(data, { plays: [{ playId: "x" }] });
  });

  it("throws on empty", () => {
    assert.throws(() => extractJsonFromLlmText("  "), /empty/);
  });
});

describe("normalizeLlmTag / parseLlmPlayTags", () => {
  it("normalizes a valid tag", () => {
    const tag = normalizeLlmTag({
      category: "Concept",
      label: "  Inside zone  ",
      confidence: 0.87,
    });
    assert.ok(tag);
    assert.equal(tag!.category, "concept");
    assert.equal(tag!.label, "Inside zone");
    assert.equal(tag!.source, "ai");
    assert.equal(tag!.confidence, 0.87);
  });

  it("rejects coach_note and bad categories", () => {
    assert.equal(normalizeLlmTag({ category: "coach_note", label: "X" }), null);
    assert.equal(normalizeLlmTag({ category: "foo", label: "X" }), null);
    assert.equal(normalizeLlmTag({ category: "concept", label: "" }), null);
  });

  it("parses LLM payload and ignores unknown play ids", () => {
    const allowed = new Set(["p1", "p2"]);
    const results = parseLlmPlayTags(
      {
        plays: [
          {
            playId: "p1",
            tags: [
              { category: "formation", label: "Shotgun", confidence: 0.9 },
              { category: "concept", label: "Inside zone", confidence: 0.8 },
              { category: "bogus", label: "Nope", confidence: 1 },
            ],
          },
          {
            playId: "unknown",
            tags: [{ category: "concept", label: "Power", confidence: 0.9 }],
          },
          {
            playId: "p2",
            tags: [
              { category: "concept", label: "Power", confidence: 0.5 },
              { category: "concept", label: "Power", confidence: 0.9 },
            ],
          },
        ],
      },
      allowed,
    );
    assert.equal(results.length, 2);
    const p1 = results.find((r) => r.playId === "p1")!;
    assert.equal(p1.tags.length, 2);
    const p2 = results.find((r) => r.playId === "p2")!;
    assert.equal(p2.tags.length, 1);
    assert.equal(p2.tags[0]!.confidence, 0.9);
  });
});

describe("heuristic batch + fill missing", () => {
  it("tags every request heuristically", () => {
    const results = tagPlaysHeuristic([
      {
        playId: "a",
        signal: {
          side: "offense",
          visionHint: "shotgun trips inside zone left",
          yardsGained: 6,
        },
      },
    ]);
    assert.equal(results.length, 1);
    assert.ok(results[0]!.tags.some((t) => t.label === "Inside zone"));
  });

  it("fills empty/missing plays with heuristics", () => {
    const requests = [
      {
        playId: "a",
        signal: { side: "offense" as const, visionHint: "shotgun power" },
      },
      {
        playId: "b",
        signal: { side: "defense" as const, visionHint: "cover 3" },
      },
    ];
    const partial = [
      {
        playId: "a",
        tags: [
          {
            id: "ai:concept:power",
            category: "concept" as const,
            label: "Power",
            source: "ai" as const,
            confidence: 0.9,
          },
        ],
      },
    ];
    const filled = fillMissingWithHeuristics(requests, partial);
    assert.equal(filled.length, 2);
    assert.equal(filled[0]!.tags[0]!.label, "Power");
    assert.ok(filled[1]!.tags.length > 0);
  });
});

describe("resultsToTagMap + coach non-clobber via merge", () => {
  it("maps results and mergeTags keeps coach", () => {
    const map = resultsToTagMap([
      {
        playId: "p1",
        tags: [
          {
            id: "ai:concept:power",
            category: "concept",
            label: "Power",
            source: "ai",
            confidence: 0.95,
          },
        ],
      },
    ]);
    const coach: PlayTag = {
      id: "coach:concept:power",
      category: "concept",
      label: "Power",
      source: "coach",
    };
    const merged = mergeTags([coach], map.p1!);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.source, "coach");
  });
});
