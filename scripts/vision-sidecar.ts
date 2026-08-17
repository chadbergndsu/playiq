#!/usr/bin/env npx tsx
/**
 * PlayIQ local vision sidecar — emits Open Film Package JSON.
 *
 * Usage:
 *   npx tsx scripts/vision-sidecar.ts --out vision.ofp.json --opponent Westfield --week 3
 *   npx tsx scripts/vision-sidecar.ts --duration 900 --seed 42 --out out.ofp.json
 */
import { writeFileSync } from "node:fs";
import { serializeOfp } from "../src/lib/core/ofp";
import {
  syntheticFrameStats,
  visionResultToOfp,
} from "../src/lib/core/vision-pipeline";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const durationSec = Number(arg("duration", "600"));
const seed = Number(arg("seed", "7"));
const opponent = arg("opponent", "Sidecar") ?? "Sidecar";
const week = Number(arg("week", "1"));
const out = arg("out", "playiq-vision.ofp.json") ?? "playiq-vision.ofp.json";
const fileName = arg("file");

const frames = syntheticFrameStats(durationSec, seed);
const now = new Date();
const filmId = `film_cli_${now.getTime().toString(36)}`;
const { package: pkg } = visionResultToOfp({
  film: {
    id: filmId,
    title: `vs ${opponent}`,
    opponent,
    week,
    season: String(now.getFullYear()),
    date: now.toISOString().slice(0, 10),
    venue: "home",
    level: "varsity",
    durationSec,
    status: "needs_review",
    sourceFileName: fileName,
  },
  frames,
  seed,
  now,
});

writeFileSync(out, serializeOfp(pkg));
console.log(`[vision-sidecar] wrote ${out} (${pkg.plays.length} plays, OFP ${pkg.version})`);
