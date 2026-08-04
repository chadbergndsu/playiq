# ADR 0004 — Open Film Exchange stack

## Status

Accepted — 2026-08-03

## Context

Commercial film rooms (Hudl, QwikCut, Sportscode packages) optimize for proprietary playlists and closed code windows. Coaches who want to leave, script FFmpeg cutups, or version film metadata in git are stuck. Open-source video (FFmpeg, WebVTT) and open coaching vocabulary exist but are almost never first-class product features.

Research threads considered and **not** bolted in raw form:

| Idea | Why deferred |
|------|----------------|
| YOLO / ByteTrack player tracking | Heavy model hosting; soccer-first FOSS; not coach-day-1 UX |
| ffmpeg.wasm full re-encode in browser | Large download, weak for long game film today |
| MediaPipe pose technique | Valuable later; orthogonal to tag → teach loop |
| Roboflow sports pipelines | Cloud dependency; not “own the code” |

## Decision

Ship a **portable open stack** inside PlayIQ:

1. **Open Play Ontology (OPO)** — versioned concept IDs + aliases (`src/lib/core/ontology.ts`).
2. **Open Film Package (OFP)** — JSON import/export with ontology IDs (`ofp.ts`).
3. **WebVTT** chapters + metadata tracks (`webvtt.ts`) — W3C standard.
4. **FFmpeg concat list, filter script, simple EDL** (`edl.ts`) — open editorial.
5. **SVG formation diagrams** (`formation-svg.ts`) — open graphics, no play-drawer SaaS.
6. **Exchange** UI at `/app/exchange`.

## Consequences

- Coaches can exit with machine-readable film data and open tooling scripts.
- AI tags map into stable ontology IDs for inter-program exchange.
- Future CV/encode pipelines can write the same OFP/WebVTT contracts.
- Not a full multi-angle NLE — by design (simplicity first).
