# PlayIQ — handoff (public product)

**Repo:** https://github.com/chadbergndsu/playiq  
**Branch:** `main`  
**Prod:** https://playiq-three.vercel.app

## Quick start

```bash
git clone git@github.com:chadbergndsu/playiq.git
cd playiq
npm install
cp .env.example .env   # set PLAYIQ_SCHOOL_CODE (+ optional PLAYIQ_SCHOOL_NAME)
npm run dev            # http://0.0.0.0:8080
```

Open `/join`, enter the school code, then use the film room.

## Privacy (public repo rules)

- **Do not commit student names, rosters with real kids, school calendars, or youth film.**
- `public/clips/` stays empty in git (see `public/clips/README.md`).
- Default seed is an **empty library**. Optional **Load product demo** is fake varsity only.
- Persist key: **`playiq-demo-v17`**

## School code

| Env | Purpose |
| --- | --- |
| `PLAYIQ_SCHOOL_CODE` | Required to unlock `/app` via `/join` |
| `PLAYIQ_SCHOOL_NAME` | Display name in the workspace |
| `PLAYIQ_SCHOOL_SEASON_LABEL` | Optional season label |
| `PLAYIQ_ADMIN_EMAILS` | Bootstrap Team admin invites |

API: `POST /api/school/unlock` with `{ "code": "…" }`.

## Coach product rules

| Lock | Truth |
| ---- | ----- |
| Tag precedence | `source: "coach"` never gets clobbered by AI |
| Honesty | Do not invent shotgun / down / exact yards |
| Tracking OCR | Jersey `#?` suggestions need coach confirm |

## Roles

| Role | Access |
| ---- | ------ |
| `admin` | Full app + Team invites |
| `head_coach` / `coach` | Film room |
| `parent` | Stub + roster; teach reels via share links |

## Local tracking (optional)

```bash
npm run tracker:setup
npm run tracker   # 127.0.0.1:8788
```

Select a play → **Track this play**. Video stays on-device.

## Stack

TanStack Start + React 19 + Vite 8 + Tailwind v4 + zustand.  
`npm run dev` → `0.0.0.0:8080`.
