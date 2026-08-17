#!/usr/bin/env node
/**
 * PlayIQ local vision sidecar (CLI) — emits Open Film Package JSON.
 *
 * Browser uses Mediabunny frame sampling; this CLI uses the pure synthetic
 * path so CI/servers without WebCodecs still produce the same OFP contract.
 *
 * Usage:
 *   node scripts/vision-sidecar.mjs --out vision.ofp.json --opponent Westfield --week 3
 *   node scripts/vision-sidecar.mjs --duration 900 --seed 42 --out out.ofp.json
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  // Dynamic import compiled? Use inline pure logic mirrored for CLI independence
  // so we don't need tsx for deploy scripts.
  const durationSec = Number(arg("duration", "600"));
  const seed = Number(arg("seed", "7"));
  const opponent = arg("opponent", "Sidecar");
  const week = Number(arg("week", "1"));
  const out = arg("out", "playiq-vision.ofp.json");

  // Minimal reimplementation calling through tsx if available
  try {
    const { register } = await import("tsx/esm/api");
    register();
    const { syntheticFrameStats, visionResultToOfp } = await import(
      "../src/lib/core/vision-pipeline.ts"
    );
    const { serializeOfp } = await import("../src/lib/core/ofp.ts");
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
        sourceFileName: arg("file", undefined),
      },
      frames,
      seed,
      now,
    });
    writeFileSync(out, serializeOfp(pkg));
    console.log(`[vision-sidecar] wrote ${out} (${pkg.plays.length} plays)`);
    return;
  } catch (err) {
    if (has("verbose")) console.error(err);
    console.error(
      "[vision-sidecar] failed — run with: npx tsx scripts/vision-sidecar.mjs …",
    );
    console.error(err?.message || err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
} else {
  main();
}
