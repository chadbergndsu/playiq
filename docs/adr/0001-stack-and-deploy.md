# ADR 0001 — Stack and deploy defaults

## Status

Accepted — 2026-08-03

## Context

New project (PlayIQ) must follow Solid Systems Standards: portable ownership, automated quality, Vercel-default deploy for web apps.

## Decision

- **App framework:** TanStack Start (React 19 + Vite) with TypeScript strict mode.
- **Styling:** Tailwind CSS v4.
- **Auth:** Pre-wired Better Auth federated to Grok broker (Google, X only).
- **Database:** Postgres via `DATABASE_URL` (Neon on deploy); PGLite in live preview.
- **Deploy:** Vercel, Git-connected to the private GitHub repository.
- **Quality gates:** ESLint + Prettier, `tsc --noEmit`, `node:test` unit tests, GitHub Actions CI on every PR/push to `main`.

## Consequences

- Fast iteration and PR previews on Vercel.
- Product logic should stay testable outside route handlers (`src/lib/core`).
- AWS or other backends only if requirements clearly demand them later.
