# PlayIQ

AI-first football film analysis for coaches and programs.

**Status:** Solid Systems baseline solid. Product features not started yet.

**Repo:** [chadbergndsu/playiq](https://github.com/chadbergndsu/playiq) (private)

## Purpose

PlayIQ is a private product scaffold aimed at football video workflows: capture, auto-tag, review, and teach. This repository ships the engineering baseline required by [Solid Systems Standards](https://github.com/chadbergndsu/solid-systems-standards) before product work.

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

1. Private GitHub repo: [chadbergndsu/playiq](https://github.com/chadbergndsu/playiq).
2. In [Vercel](https://vercel.com/new): **Import** → select `chadbergndsu/playiq` (Git-connected).
3. Set env vars from `.env.example` in the Vercel project (never commit secrets).
4. Push to `main` → production deploy. PRs get preview URLs automatically.
5. HTTPS is enforced by Vercel.

Framework: custom (`vercel.json` sets `buildCommand` / `installCommand`). Root directory: repo root.

## Solid Systems Done checklist

| Item | Status |
|------|--------|
| GitHub repo created (private) | **Done** — [chadbergndsu/playiq](https://github.com/chadbergndsu/playiq) |
| Baseline committed & pushed to `main` | **Done** — CI green on first push |
| Main branch protected + required PR reviews / status checks | **Open** — GitHub Free private repos cannot enable classic branch protection (needs Pro/Team or public). Enable after upgrade or via Rulesets if available. |
| Clear README | **Done** |
| `.env.example` (no real secrets committed) | **Done** |
| Proper `.gitignore` | **Done** |
| Linter + formatter (ESLint + Prettier) | **Done** — runs in CI |
| TypeScript enabled | **Done** |
| Basic tests for core logic | **Done** — `src/lib/core/health.test.ts` |
| GitHub Actions CI (lint → typecheck → test) | **Done** — passes on `main` / PRs |
| Secrets only via platform env / GitHub Secrets | **Done** — documented |
| Error tracking (Sentry) live for production | **Open** — `SENTRY_DSN` placeholders in `.env.example`; wire when first prod deploy |
| Deployment from Git (Vercel default) | **Ready** — `vercel.json` + README; **Git-connect still needs one Vercel Import** (no Vercel token in agent) |
| HTTPS only | **Done** — via Vercel |
| Basic health check | **Done** — `GET /api/health` |
| Dependabot | **Done** — `.github/dependabot.yml` |
| ADR for stack/deploy | **Done** — `docs/adr/0001-stack-and-deploy.md` |
| Auth via proven library | **Done** — Better Auth |

## Agent rules

See [`AGENTS.md`](./AGENTS.md) (Solid Systems Standards v1.3 embedded).

---

*Solid Systems Standards v1.3 — baseline bootstrapped 2026-08-03*
