import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jerseySuggestionsForWindow,
  mergeTrackingArtifacts,
  trackingFrameAt,
  type TrackingArtifact,
} from "./tracking";

const artifact: TrackingArtifact = {
  version: 1,
  filmId: "film_1",
  sourceFileName: "game.mp4",
  width: 1920,
  height: 1080,
  analyzedFps: 5,
  durationSec: 10,
  model: "test",
  createdAt: "2026-08-16T00:00:00.000Z",
  warnings: [],
  frames: [
    {
      t: 1,
      detections: [
        {
          trackId: "player-1",
          kind: "player",
          box: { x: 0.1, y: 0.1, width: 0.2, height: 0.5 },
          confidence: 0.9,
          jerseyNumber: 29,
          jerseyConfidence: 0.7,
        },
      ],
    },
    {
      t: 1.2,
      detections: [
        {
          trackId: "player-1",
          kind: "player",
          box: { x: 0.12, y: 0.1, width: 0.2, height: 0.5 },
          confidence: 0.88,
          jerseyNumber: 29,
          jerseyConfidence: 0.8,
        },
      ],
    },
  ],
};

describe("tracking", () => {
  it("selects the closest fresh frame", () => {
    assert.equal(trackingFrameAt(artifact, 1.16)?.t, 1.2);
    assert.equal(trackingFrameAt(artifact, 2), null);
  });

  it("aggregates jersey suggestions inside a play window", () => {
    const suggestions = jerseySuggestionsForWindow(artifact, 0.9, 1.3);
    assert.deepEqual(suggestions, [{ number: 29, confidence: 0.75, sightings: 2 }]);
    assert.deepEqual(jerseySuggestionsForWindow(artifact, 2, 3), []);
  });

  it("replaces only the newly analyzed play window", () => {
    const incoming: TrackingArtifact = {
      ...artifact,
      frames: [
        { t: 1.2, detections: [] },
        { t: 1.4, detections: [] },
      ],
      warnings: ["new"],
    };
    const existing = {
      ...artifact,
      frames: [...artifact.frames, { t: 1.1, detections: [] }],
    };
    const merged = mergeTrackingArtifacts(existing, incoming, {
      startSec: 1.05,
      endSec: 1.45,
    });
    assert.deepEqual(
      merged.frames.map((frame) => frame.t),
      [1, 1.2, 1.4],
    );
    assert.deepEqual(merged.warnings, ["new"]);
  });
});
