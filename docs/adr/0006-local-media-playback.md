# ADR 0006 — Local media playback + IndexedDB registry

## Status

Accepted — 2026-08-03

## Context

Cut assembly and vision already used in-memory blobs, but film review still showed a demo field silhouette. Refresh also wiped media. Coaches need: attach game file → watch real video clamped to plays → WebVTT chapters → survive reload — without cloud storage.

## Decision

1. **HTML5 `<video>`** on `VideoStage` when a film has registered media.
2. **WebVTT chapters** generated from plays and attached as a track.
3. **IndexedDB** (`playiq-media-v1`) persists `{ filmId, fileName, blob }` so media survives refresh.
4. **Hydrate** registry during `PlayiqHydrate` alongside Zustand rehydrate.
5. Play selection seeks video and clamps playback to `startSec`–`endSec`.

## Consequences

- Full local loop: upload/attach → review → AI tags → cutup → assemble MP4.
- Large films use disk via IDB; quota limits apply (user-visible browser limits).
- No cloud CDN encode yet — intentional portability / privacy wedge.
