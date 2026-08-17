# ADR 0002 — SpaceXAI for film play tagging

## Status

Accepted — 2026-08-03

## Context

PlayIQ’s wedge is AI-first film analysis. Demo tagging used pure heuristics in `src/lib/core/tagging.ts`. Coaches must be able to correct tags without AI overwriting their work. The product needs a real LLM path when `XAI_API_KEY` is set, without locking the film room to an online model.

## Decision

- **Provider:** SpaceXAI / xAI (`XAI_API_KEY`, `https://api.x.ai/v1`, default model `grok-4.5`).
- **Boundary:** Key and HTTP live only on the server (`src/lib/server/xai-tagger.ts` + `POST /api/film/tag`). Prompt build, JSON parse, validation, and merge stay pure in `src/lib/core`.
- **Fallback:** If the key is missing or a batch fails, use local heuristics. Never fail the film room silently.
- **Coach tags:** `mergeTags` always keeps `source: "coach"` on label collision; AI fills gaps only.
- **No new SDK dependency:** `fetch` to OpenAI-compatible chat completions keeps the surface small and portable.

## Consequences

- Setting `XAI_API_KEY` in Vercel/local `.env` upgrades “Re-run AI tags” to LLM mode without client changes.
- Unit tests cover parse/merge/fallback without network.
- Future vision/encode pipelines can feed `visionHint` into the same request shape.
