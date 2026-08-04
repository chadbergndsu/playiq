import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  playsToFfmpegConcatList,
  playsToFfmpegFilterComplex,
  playsToSimpleEdl,
} from "./edl";
import type { Play } from "./types";

const play: Play = {
  id: "p1",
  filmId: "f1",
  index: 1,
  startSec: 10,
  endSec: 18,
  quarter: 1,
  clock: "12:00",
  side: "offense",
  tags: [{ id: "a", category: "concept", label: "Power", source: "ai" }],
};

describe("open editorial exports", () => {
  it("builds ffmpeg concat list with in/out points", () => {
    const txt = playsToFfmpegConcatList([
      { play, mediaPath: "/media/week1.mp4" },
    ]);
    assert.match(txt, /file '\/media\/week1\.mp4'/);
    assert.match(txt, /inpoint 10\.000/);
    assert.match(txt, /outpoint 18\.000/);
  });

  it("builds simple EDL and filter script", () => {
    const edl = playsToSimpleEdl([{ play, mediaPath: "week1.mp4" }], {
      title: "Install",
    });
    assert.match(edl, /TITLE: Install/);
    assert.match(edl, /PLAY 1/);
    const sh = playsToFfmpegFilterComplex([
      { play, mediaPath: "week1.mp4" },
    ]);
    assert.match(sh, /filter_complex/);
    assert.match(sh, /trim=start=10/);
  });
});
