# ADR 0005 — Mediabunny cut assembly + local vision OFP sidecar

## Status

Accepted — 2026-08-03

## Context

Coaches need real MP4 teach clips without uploading game film to a vendor cloud. Open web standards now expose **WebCodecs**; **Mediabunny** (MPL-2.0) is a pure TypeScript toolkit on top of them. Separately, YOLO-class trackers exist in FOSS but are heavy; we need a vision path that still emits **Open Film Package** so models can be swapped later.

## Decision

1. **Cut assembly** — `mediabunny` `Conversion` with `trim` for each play; multi-clip results as ZIP (store-only) + FFmpeg concat list (`src/lib/media/cut-assembly.ts`).
2. **Session media registry** — browser `Blob` map by film id (not persisted).
3. **WebVTT import** — parse chapters/metadata back into plays (`importWebVttToPlays`).
4. **Local vision** — frame stats (luma + scene delta) via Mediabunny canvas sampling, pure segmenter + heuristic tags → OFP (`vision-pipeline.ts`, `vision-client.ts`). CLI: `npm run vision-sidecar`.
5. **YOLO deferred** — same OFP output contract when a model is added.

## Consequences

- Game film can stay on-device for cut export and first-pass segmentation.
- Browser codec support varies; UI degrades with clear errors + synthetic CLI path.
- ZIP is uncompressed (simple, pure); large cutups may be bulky (acceptable for demo).
