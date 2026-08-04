# PlayIQ

AI-first football film analysis for coaches and programs.

**Status:** Product demo live — film library, AI tagging, review workspace, cutups, insights.

## Purpose

PlayIQ is a Hudl-style film workflow wedge: upload/review season film, get an AI first-pass of formations/concepts/situations, correct with coach tags, and ship teach cutups before practice.

## What’s in the app

| Area | What you can do |
|------|-----------------|
| **Landing** | Product pitch + enter film room |
| **Overview** | Season stats, recent film, top concepts |
| **Film library** | 8-game demo season, search/filter by status |
| **Film review** | Timeline, play list, demo stage, AI + coach tags, notes, keyboard J/K/Space |
| **AI tagging** | **Re-run AI tags** → `POST /api/film/tag` (SpaceXAI when `XAI_API_KEY` set; heuristics otherwise). Coach tags never clobbered. |
| **Cutups** | Filtered teach reels (save from any film filter) |
| **Insights** | Weekly charts, concept frequency, situation counts |
| **Auth** | Better Auth (Google / X) — film room works without sign-in |

Demo data is seeded client-side (persisted in the browser). **Reset demo data** on Overview restores the stock season.

## Tech stack

| Layer | Choice |
|-------|--------|
| App | TanStack Start (React 19 + Vite 8) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 — dark film-room tokens |
| State | Zustand (persist) |
| Auth | Better Auth + Grok broker (Google, X) |
| Database | Postgres (`DATABASE_URL`) / PGLite in preview |
| Charts | Recharts |
| Deploy | Vercel (Git-connected, default) |
| Quality | ESLint, Prettier, `tsc`, `node:test` + `tsx`, GitHub Actions |

## Setup

```bash
# Node 22+
npm ci
cp .env.example .env   # optional for local tooling; never commit real secrets
# Optional: set XAI_API_KEY in .env for real SpaceXAI play tagging
npm run dev            # http://0.0.0.0:8080
```

### AI tagging (SpaceXAI)

| Mode | When | Behavior |
|------|------|----------|
| **LLM** | `XAI_API_KEY` set on the server | Batched chat completions (`grok-4.5` by default); structured JSON tags |
| **Heuristic** | No key, or LLM error | Local rules in `src/lib/core/tagging.ts` (always available) |

- Endpoint: `POST /api/film/tag` with `{ filmId, plays: [...] }`.
- Response: `{ mode, playTags, xaiConfigured, warning? }`.
- Health: `GET /api/health` reports `checks.xai` (`pass` if key present). Missing key does **not** degrade overall status.
- Key is **server-only** — never put `XAI_API_KEY` in `VITE_*` vars.

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
  routes/           # Pages + API (landing, /app/*, auth, health)
  components/       # App shell, film UI, small UI primitives
  lib/core/         # Framework-free domain: tagging, LLM parse, cutups, seed
  lib/server/       # Server-only: xAI tagger (API key never in client bundle)
  lib/store/        # Zustand demo state
  lib/auth/         # Better Auth (pre-wired; do not rewrite server.ts)
  lib/db.ts         # Postgres / PGLite access
migrations/         # Ordered SQL migrations
.github/workflows/  # CI gates
docs/adr/           # Architecture decisions
```

- Business logic that matters lives under `src/lib/core` so it stays testable.
- Auth routes: `/login`, `/api/auth/*`. Health: `/api/health`. Film AI: `/api/film/tag`.
- Deploy target is Vercel; schema migrations run on build via `npm run db:migrate`.

## Deploy

1. Private GitHub repo: [chadbergndsu/playiq](https://github.com/chadbergndsu/playiq).
2. Import the repo in [Vercel](https://vercel.com) (Git-connected).
3. Set env vars from `.env.example` in the Vercel project (never commit secrets).
4. Push to `main` → production deploy. PRs get preview URLs automatically.
5. HTTPS is enforced by Vercel.

## Solid Systems Done checklist

- [x] GitHub repo created (private by default) — [chadbergndsu/playiq](https://github.com/chadbergndsu/playiq)
- [x] Baseline code pushed to `main` + CI green on push
- [ ] Main branch protection + required PR reviews / status checks  
  **Blocked:** GitHub Free private repos reject classic branch protection (needs Pro/Team, or public, or Rulesets if available). When available, require status check **`Lint · Typecheck · Test`**.
- [x] Clear README (purpose, stack, setup, architecture, deploy)
- [x] `.env.example` present (no real secrets committed)
- [x] Proper `.gitignore`
- [x] Linter + formatter configured (ESLint + Prettier)
- [x] TypeScript enabled
- [x] Basic tests for core logic (health, tagging, LLM parse, xAI fallback, cutups)
- [x] GitHub Actions CI (lint → typecheck → test) on PR/push to `main`
- [x] Secrets only via platform env / GitHub Secrets (documented)
- [ ] Error tracking (Sentry) live for production — placeholders in `.env.example`; wire on first real prod deploy
- [x] Deployment from Git documented (`vercel.json` + README)  
  **Open (manual):** connect this repo in the Vercel dashboard (no Vercel token in agent env)
- [x] HTTPS only (via Vercel)
- [x] Basic health check (`GET /api/health`)
- [x] Dependabot enabled (`.github/dependabot.yml`)
- [x] ADR for stack/deploy (`docs/adr/0001-stack-and-deploy.md`)
- [x] Auth via proven library (Better Auth)

### Your two remaining baseline clicks

1. **Vercel:** [Import `chadbergndsu/playiq`](https://vercel.com/new) → Git-connected → env from `.env.example`.
2. **Branch protection:** after GitHub Pro/Team (or if Rulesets work), require PR + check **`Lint · Typecheck · Test`**.

## Agent rules

See [`AGENTS.md`](./AGENTS.md) (Solid Systems Standards v1.3 embedded).

---

*Solid Systems Standards v1.3 — product demo 2026-08-03*
