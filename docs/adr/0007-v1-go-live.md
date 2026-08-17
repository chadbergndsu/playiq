# ADR 0007 — v1.0.0 production go-live

## Status

Accepted — 2026-08-04

## Context

PlayIQ has Solid Systems baseline, product film room, open exchange stack, Neon Postgres, and Vercel Git deploys. Remaining optional items (Sentry, branch protection, XAI key) do not block a coach-facing public demo.

## Decision

Ship **v1.0.0** as production live:

- Production URLs: `https://playiq-three.vercel.app` (primary), team alias `playiq-chadbergndsus-projects.vercel.app`  
  Note: `playiq.vercel.app` is a different legacy project name and is **not** this app.
- Health version `1.0.0`
- Neon + migrations on build
- Share API durable on Postgres

## Consequences

- Push to `main` continues automatic production deploys
- Optional secrets (XAI, Sentry) can be added without a version ceremony
- Product is demo-complete; cloud encode CDN remains future work
