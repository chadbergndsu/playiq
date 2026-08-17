# ADR 0010 — Auth-gated mutators, share TTL, production secret guards

## Status

Accepted — 2026-08-04

## Context

Security review after v1.1.1 found residual High risks: open paid LLM path, open share create, immortal shares, config recon, open redirect residual, and production fallback to preview OAuth / random auth secret.

## Decision

Ship **v1.1.2**:

1. **Share POST** requires a session (or DEV_USER when auth is explicitly off without DATABASE_URL); GET remains capability-token public; **30-day `expires_at`**.
2. **Tag POST** never calls xAI for anonymous users when a key is set (heuristics only); opaque `mode: "ok"`; no client `tags` accepted.
3. **Same-site** check on mutating API helpers; trusted client IP for rate limits.
4. **Same-origin-only** post-auth / sign-out redirects.
5. **Boot fail** when `DATABASE_URL` is set without `BETTER_AUTH_SECRET` or with preview OAuth client.
6. **CSP** baseline on Vercel; VTT line sanitization; prompt data framing; share tokens not persisted to localStorage.

## Consequences

- Publishing a share link requires sign-in in production.
- Live AI tagging requires sign-in when `XAI_API_KEY` is configured.
- Misconfigured production auth fails loudly instead of using sandbox credentials.
