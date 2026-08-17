# ADR 0009 — Security, playback, and data-path hardening (v1.1.1)

## Status

Accepted — 2026-08-04

## Context

Full prototype review found P0 share hijack (unauthenticated UPSERT + client tokens), open tag API cost abuse, VideoStage auto-advance/resume bugs, upload finalize races, lying health DB status, multi-film assemble order bugs, OFP cutup drop, and missing CI build.

## Decision

Ship **v1.1.1** hardening without blocking coach demo flows that work signed-out:

1. **Share writes** — server-mint CSPRNG tokens; insert-only (no UPSERT); strict payload normalize/caps; rate limits; generic 500s; private no-store GET.
2. **Tag API** — rate limits, body size caps, clamped vision/notes, finite numbers only, generic errors; do not advertise `xaiConfigured` on public responses.
3. **VideoStage** — end latch, native `ended`, seek+play via `playbackEpoch`, paused-only scrub seek.
4. **Store** — upload finalize only while `processing` + generation token; reset clears media IDB.
5. **OFP** — merge cutups by id; filter unknown play ids.
6. **Assemble** — preserve teach order; multi-source per `filmId`.
7. **Health** — real `SELECT 1` ping; strip public `xai` check from response body.
8. **CI** — `npm run build` gate; security headers on Vercel.

## Consequences

- Re-publish always creates a **new** share URL (immutable capability links).
- Anonymous demo still works; abuse is rate-limited per isolate (not global Redis).
- Auto-advance with local media should resume clips correctly.
