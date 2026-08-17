# ADR 0003 — Market parity slice (cutups, upload, tendencies)

## Status

Accepted — 2026-08-03

## Context

Compared to Hudl, QwikCut, Sportscode, and similar film tools, PlayIQ’s demo lacked several coach expectations: real upload intake, shareable playlists, export, playback speed, play bookmarks, deep filters, tendency reports, cutup editing, keyboard help, and clear competitive positioning.

## Decision

Ship a focused parity slice without multi-angle video or cloud encode:

1. Local upload creates a film + AI first-pass plays (status processing → needs_review).
2. Cutup share snapshots in Postgres/PGLite (`cutup_shares`) + public `/share/$token`.
3. CSV/JSON export from pure domain helpers.
4. Starred plays, deep filters, playback speeds, keyboard help, cutup rename/remove.
5. Insights: formation tendencies, 3rd-down conversion proxy, down×distance matrix.
6. Landing comparison table vs market.

Real object storage encode and multi-angle remain future work.

## Consequences

- Coaches can demo a full “upload → tag → cut → share → export” loop.
- Share links work across browsers when the API can persist (PGLite/Neon).
- Encode/CDN still required for production video; file picker only captures metadata today.