import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playsToWebVttChapters, secToWebVttTime } from "./webvtt";
import type { Play } from "./types";

const play: Play = {
  id: "p1",
  filmId: "f1",
  index: 3,
  startSec: 65.5,
  endSec: 72,
  quarter: 1,
  clock: "10:00",
  side: "offense",
  down: 2,
  distance: 7,
  yardsGained: 12,
  tags: [{ id: "a", category: "concept", label: "Power", source: "ai" }],
};

describe("WebVTT", () => {
  it("formats timestamps", () => {
    assert.equal(secToWebVttTime(65.5), "00:01:05.500");
    assert.equal(secToWebVttTime(0), "00:00:00.000");
  });

  it("emits valid chapter cues", () => {
    const vtt = playsToWebVttChapters([play], { title: "vs Westfield" });
    assert.match(vtt, /^WEBVTT/);
    assert.match(vtt, /00:01:05\.500 --> 00:01:12\.000/);
    assert.match(vtt, /Play 3/);
    assert.match(vtt, /Power/);
  });
});
