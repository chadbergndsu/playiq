# AGENTS.md — Solid Systems Standards

You must follow the Solid Systems Standards on every task in this repository (and in every project when this file is loaded as global rules).

**Source of truth:** https://github.com/chadbergndsu/solid-systems-standards (v1.3 — 2026-08-03)

This file embeds the full standards so agents enforce them without needing network access.

---

## Goal

Reliable, maintainable, secure systems that scale with the business and don't create constant firefighting.

---

## Core Rules (non-negotiable)

1. **Simplicity first** — Build only what is needed. Complexity is the enemy. Do not add complexity that is not required.
2. **Own the code and data** — Prefer portable stacks. Minimize lock-in. You (or the client) own the repo and the IP.
3. **Automate quality** — Linting, tests, and CI are mandatory gates, not optional.
4. **Never commit secrets** — Ever.
5. **Observability is required** — If you can't see it failing, it will fail silently. Fix silent failures.
6. **Document the non-obvious** — Future you will thank present you.

---

## Mandatory Checklist

**Verify before declaring any non-trivial work done.** Report status when finishing substantial work.

- [ ] GitHub repo created (private by default)
- [ ] Main branch protected + required pull request reviews (when collaborating / shipping)
- [ ] Clear README: purpose, tech stack, setup, architecture, deploy steps
- [ ] `.env.example` present (real secrets never committed)
- [ ] Proper `.gitignore`
- [ ] Linter + formatter configured and running in CI
- [ ] Type safety where the language supports it (TypeScript strongly preferred for web)
- [ ] Basic tests for core logic
- [ ] GitHub Actions CI that runs on every PR and blocks merge on failure
- [ ] Secrets stored only in platform environment variables / GitHub Secrets
- [ ] Error tracking (Sentry or equivalent) considered / live for production
- [ ] Deployment happens from Git — no manual uploads
- [ ] HTTPS only
- [ ] Basic monitoring / uptime / health check considered

### Before finishing non-trivial work (agent duty)

1. Run lint, typecheck, and tests when those scripts exist.
2. Do not leave secrets, credentials, or API keys in source or commits.
3. Surface errors to the user or logs — never swallow failures silently.
4. Update README / docs when behavior or setup changes non-obviously.
5. Report which checklist items are done vs still open.

---

## New Project Checklist

### Setup

- [ ] Create private GitHub repository
- [ ] Protect `main` branch (require PR + status checks)
- [ ] Add CODEOWNERS if multiple people
- [ ] Standard issue and PR templates (optional but useful)

### Code Quality

- [ ] Linter + formatter (ESLint + Prettier, Biome, oxlint + Prettier, or language equivalent)
- [ ] TypeScript (or strong typing) enabled
- [ ] Unit / integration tests for critical paths
- [ ] GitHub Actions workflow: lint → typecheck → test on every PR

### Configuration

- [ ] `.env.example` with all required variables documented
- [ ] Real secrets only in Vercel / Railway / GitHub Secrets / etc.
- [ ] No secrets or credentials in git history

### Deployment & Runtime

- [ ] Deploy pipeline connected to GitHub
- [ ] Preview environments for PRs (Vercel does this automatically)
- [ ] Error tracking (Sentry) configured and tested for production
- [ ] Basic uptime / health check
- [ ] HTTPS enforced

### Documentation

- [ ] README covers: what it does, how to run locally, how to deploy, architecture overview
- [ ] ADRs for major technical decisions (`/docs/adr`)

### Security Baseline

- [ ] Dependabot or equivalent enabled
- [ ] Least privilege for any service accounts / API keys
- [ ] Auth uses a proven library/service (not custom)

Once all boxes are checked, the system is allowed to go to production.

---

## Deployment Defaults

**Use Vercel as the default** for websites, dashboards, and most web apps.

**Decision rule**

- Default to **Vercel** for websites, dashboards, light fullstack, and most client-facing tools.
- Choose **AWS** (or hybrid) only when requirements clearly demand heavy compute, compliance, or deep AWS investment.
- Do **not** choose AWS just because it sounds more "enterprise."

| Need | Recommendation |
|------|----------------|
| Backend / long-running jobs | Railway, Fly.io, Render |
| Pure edge / workers | Cloudflare Workers + Pages |
| Database | Neon or Supabase (Postgres) |
| Auth | Proven library (Better Auth, Auth.js, Clerk, Supabase Auth) |
| Error tracking | Sentry |
| Product analytics | PostHog or Vercel Analytics |

---

## Architecture Guidelines

- Follow 12-factor app principles where they apply
- Keep business logic testable and separate from framework glue
- Database migrations live in the repo
- Prefer managed services early; self-host only when there is a clear reason
- Small, focused pull requests

---

## Process

- Conventional commits preferred (or clear, consistent messages)
- Architecture Decision Records (ADRs) for non-obvious choices → `/docs/adr`
- Update the [solid-systems-standards](https://github.com/chadbergndsu/solid-systems-standards) repo when you learn something that should apply to all future systems

---

*Solid Systems Standards v1.3 — 2026-08-03*
*Global Grok path: `~/.grok/AGENTS.md` · Project path: `<repo>/AGENTS.md`*
