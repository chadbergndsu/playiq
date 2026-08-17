# ADR 0011 — Local player, ball, and jersey tracking

## Status

Accepted — 2026-08-16

## Context

Scene-cut segmentation can split a full game, but it cannot show who is on the
field or follow the ball. School film may include minors, so uploading raw
video to a third-party vision service is not an acceptable default.
Sideline film also makes ball detection and jersey OCR uncertain.

## Decision

1. Run an optional Python tracker on the coach's machine at `127.0.0.1:8788`.
2. Use Ultralytics detection + ByteTrack for player tracks and best-effort sports
   ball detection.
3. Use EasyOCR against torso crops, constrained to the school's roster numbers
   when present (public repo ships an empty roster).
4. Analyze one selected play window at a time, then merge normalized,
   timestamped boxes into a portable per-film JSON contract.
5. Persist tracking JSON in browser IndexedDB; delete temporary server video after
   every analysis.
6. Render boxes over the original HTML video with aspect/letterbox correction.
7. Display OCR jersey numbers with `?`; only a coach click creates a
   `source: "coach"` personnel tag.

## Consequences

- Film and tracking stay on the coach's device.
- Model weights download during initial setup and analysis is compute-heavy.
- Generic sports-ball detection may miss an occluded or very small football.
- Jersey OCR is a suggestion, never an automatic coach lock.
- The Vercel deployment remains lightweight; tracking runs only in the local
  workflow unless a private GPU service is designed later.
