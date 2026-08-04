import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyAiToPlay,
  averageAiConfidence,
  confidenceBand,
  countAiTags,
  generateAiTags,
  mergeTags,
} from "./tagging";
import type { Play, PlayTag } from "./types";

describe("generateAiTags", () => {
  it("tags shotgun inside zone from vision hint", () => {
    const tags = generateAiTags({
      side: "offense",
      down: 1,
      distance: 10,
      yardLine: 35,
      yardsGained: 6,
      visionHint: "shotgun trips inside zone left",
    });
    const labels = tags.map((t) => t.label);
    assert.ok(labels.includes("Shotgun"));
    assert.ok(labels.includes("Inside zone"));
  });

  it("flags 3rd & long and red zone", () => {
    const tags = generateAiTags({
      side: "offense",
      down: 3,
      distance: 12,
      yardLine: 15,
      yardsGained: 0,
      visionHint: "shotgun stick concept",
    });
    const labels = tags.map((t) => t.label);
    assert.ok(labels.includes("3rd & long"));
    assert.ok(labels.includes("Red zone"));
  });

  it("marks explosive and touchdown", () => {
    const tags = generateAiTags({
      side: "offense",
      yardsGained: 45,
      isExplosive: true,
      isScore: true,
      visionHint: "shotgun four verticals",
    });
    const labels = tags.map((t) => t.label);
    assert.ok(labels.includes("Explosive"));
    assert.ok(labels.includes("Touchdown"));
  });
});

describe("mergeTags", () => {
  it("does not clobber coach tags", () => {
    const coach: PlayTag = {
      id: "coach:concept:power",
      category: "concept",
      label: "Power",
      source: "coach",
    };
    const ai: PlayTag = {
      id: "ai:concept:power",
      category: "concept",
      label: "Power",
      source: "ai",
      confidence: 0.9,
    };
    const merged = mergeTags([coach], [ai]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.source, "coach");
  });

  it("adds AI tags for new labels", () => {
    const ai = generateAiTags({
      side: "defense",
      visionHint: "cover 3 sky pressure edge",
    });
    const merged = mergeTags([], ai);
    assert.ok(merged.length >= 1);
    assert.ok(merged.every((t) => t.source === "ai"));
  });
});

describe("applyAiToPlay", () => {
  it("enriches empty tags", () => {
    const play: Play = {
      id: "p1",
      filmId: "f1",
      index: 1,
      startSec: 0,
      endSec: 8,
      quarter: 1,
      clock: "12:00",
      side: "offense",
      down: 2,
      distance: 7,
      yardLine: 40,
      yardsGained: 4,
      tags: [],
    };
    const next = applyAiToPlay(play, {
      side: "offense",
      visionHint: "pistol 11 personnel power right",
      yardsGained: 4,
    });
    assert.ok(next.tags.length > 0);
    assert.ok(next.tags.some((t) => t.label === "Power"));
  });
});

describe("confidence helpers", () => {
  it("bands confidence", () => {
    assert.equal(confidenceBand(0.9), "high");
    assert.equal(confidenceBand(0.65), "medium");
    assert.equal(confidenceBand(0.4), "low");
    assert.equal(confidenceBand(undefined), "n/a");
  });

  it("counts and averages AI tags", () => {
    const plays: Play[] = [
      {
        id: "a",
        filmId: "f",
        index: 1,
        startSec: 0,
        endSec: 5,
        quarter: 1,
        clock: "1:00",
        side: "offense",
        tags: [
          { id: "1", category: "concept", label: "A", source: "ai", confidence: 0.8 },
          { id: "2", category: "concept", label: "B", source: "coach" },
        ],
      },
      {
        id: "b",
        filmId: "f",
        index: 2,
        startSec: 5,
        endSec: 10,
        quarter: 1,
        clock: "0:50",
        side: "defense",
        tags: [{ id: "3", category: "concept", label: "C", source: "ai", confidence: 0.6 }],
      },
    ];
    assert.equal(countAiTags(plays), 2);
    assert.equal(averageAiConfidence(plays), 0.7);
  });
});
