# PlayIQ

AI-first football film analysis for coaches and programs.

**Status:** Solid Systems baseline complete. Product features not started yet.

## Purpose

PlayIQ is a private product scaffold aimed at football video workflows: capture, auto-tag, review, and teach. This repository currently ships the engineering baseline required by [Solid Systems Standards](https://github.com/chadbergndsu/solid-systems-standards) before product work.

## Tech stack

| Layer | Choice |
|-------|--------|
| App | TanStack Start (React 19 + Vite 8) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Auth | Better Auth + Grok broker (Google, X) |
| Database | Postgres (`DATABASE_URL`) / PGLite in preview |
| Deploy | Vercel (Git-connected, default) |
| Quality | ESLint, Prettier, `tsc`, `node:test` + `tsx`, GitHub Actions |

## Setup

```bash
# Node 22+
npm ci
cp .env.example .env   # optional for local tooling; never commit real secrets
npm run dev            # http://0.0.0.0:8080
```

### Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Dev server on port 8080 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Unit tests (`src/**/*.test.ts`) |
| `npm run ci` | lint + typecheck + test |
| `npm run build` | Production build + DB migrations |
| `npm run format` | Prettier write |

## Architecture

```
src/
  routes/           # TanStack file routes (pages + API)
  lib/auth/         # Better Auth (pre-wired; do not rewrite server.ts)
  lib/core/         # Framework-free domain logic (unit-tested)
  lib/db.ts         # Postgres / PGLite access
migrations/         # Ordered SQL migrations
.github/workflows/  # CI gates
docs/adr/           # Architecture decisions
```

- Business logic that matters lives under `src/lib/core` so it stays testable.
- Auth routes: `/login`, `/api/auth/*`. Health: `/api/health`.
- Deploy target is Vercel; schema migrations run on build via `npm run db:migrate`.

## Deploy

1. Private GitHub repo (this one).
2. Import the repo in [Vercel](https://vercel.com) (Git-connected).
3. Set env vars from `.env.example` in the Vercel project (never commit secrets).
4. Push to `main` → production deploy. PRs get preview URLs automatically.
5. HTTPS is enforced by Vercel.

## Solid Systems Done checklist

- [x] GitHub repo created (private by default)
- [ ] Main branch protected + required PR reviews / status checks
- [x] Clear README (purpose, stack, setup, architecture, deploy)
- [x] `.env.example` present (no real secrets committed)
- [x] Proper `.gitignore`
- [x] Linter + formatter configured (ESLint + Prettier)
- [x] TypeScript enabled
- [x] Basic tests for core logic (`src/lib/core/health.test.ts`)
- [x] GitHub Actions CI (lint → typecheck → test) on PR/push to `main`
- [x] Secrets only via platform env / GitHub Secrets (documented)
- [ ] Error tracking (Sentry) live for production
- [x] Deployment from Git (Vercel default target documented + `vercel.json`)
- [x] HTTPS only (via Vercel)
- [x] Basic health check (`GET /api/health`)
- [x] Dependabot enabled (`.github/dependabot.yml`)
- [x] ADR for stack/deploy (`docs/adr/0001-stack-and-deploy.md`)
- [x] Auth via proven library (Better Auth)

## Agent rules

See [`AGENTS.md`](./AGENTS.md) (Solid Systems Standards v1.3 embedded).

---

*Solid Systems Standards v1.3 — baseline bootstrapped 2026-08-03*
