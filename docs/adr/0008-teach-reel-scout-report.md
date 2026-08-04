# ADR 0008 — Teach reel player + open scout report

## Status

Accepted — 2026-08-04

## Context

v1.0.0 shipped film review, cutup lists, share, export, and assembly — but coaches still left the app to *run* an install meeting or hand a self-scout to position staff. Cutup detail was a static list; Insights charts were not portable.

## Decision

Ship **v1.1.0** product slice:

1. **Teach queue** (`src/lib/core/teach-queue.ts`) — ordered clips, auto-advance, loop; unit-tested pure domain.
2. **Cutup detail = teach room** — `VideoStage` with local media when registered, demo stage otherwise; Space / J / K / A / L keys.
3. **Film review auto-advance** — optional end-of-play → next filtered play (same teach habit on single film).
4. **Install from stars** — `buildCutupFromPlayIds` + store helper; one click from Cutups.
5. **Scout report** (`src/lib/core/scout-report.ts`) — Markdown + print-friendly HTML from tendencies; opponent filter optional.

## Consequences

- No new backend or secrets required.
- Cloud CDN encode remains out of scope.
- Coaches can run install from a shareable teach reel and export a vendor-free scout pack.
