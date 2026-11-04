# VEYRATH

Veyrath is an original browser-based fantasy tabletop RPG in active development. The first delivery focuses on a real campaign workspace and a secure Supabase foundation; exploration, characters, and turn-based combat are planned as subsequent, testable phases.

## Current state

- **Local Workshop mode:** available without credentials. Campaigns are stored in this browser's `localStorage` only; they are not accounts, cloud saves, invitations, or multiplayer.
- **Cloud mode:** Supabase Auth and campaign operations are enabled after configuring a Supabase project and applying the versioned migration. Campaign creation is performed under RLS; invite-code joins use a database RPC.
- **Game engine:** React + TypeScript + Vite UI, Phaser 3 runtime scaffold, and a separate game/engine boundary.
- **Assets:** no third-party art has been copied into the game. See `ASSET_REPORT.md`, `asset-catalog.json`, and `asset-licenses.json` for the current audit.

## Run locally

Requirements: Node.js 22.22.2+ (tested here with 22.22.3) and npm.

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. With no `.env.local`, the app opens in clearly labelled Local Workshop mode. This mode is useful for exercising campaign creation on one browser; it does not simulate network play.

## Enable Supabase cloud mode

1. Create a Supabase project on a plan appropriate for your use.
2. Apply `supabase/migrations/202611040001_initial_schema.sql` in the Supabase SQL Editor (or with your established Supabase CLI workflow).
3. Enable the email/password provider in Supabase Auth. Configure email confirmation to match your project policy.
4. Copy `.env.example` to `.env.local` and set the project URL and the **publishable/anon** key. Never use the service-role key in the frontend.
5. Restart Vite. The app will show the real sign-in/sign-up flow instead of Local Workshop mode.

See [`docs/supabase-setup.md`](docs/supabase-setup.md) for schema, RLS, and validation details. Cloud mode has not been connected to a live project in this checkout; no credentials were supplied, so live authentication and database round-trips remain to be verified against a configured Supabase project.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The Playwright smoke test requires a Chromium browser installed with `npx playwright install chromium`. Unit tests and the production build do not require a cloud project.

## Project map

- `src/app/` — React screens and UI components.
- `src/services/` — Supabase and explicitly local-only campaign data access.
- `src/game/` — Phaser runtime boundary; no map is claimed playable yet.
- `src/engine/` — rules-engine boundary (its D20/combat rules are not implemented yet); campaign input validation currently lives in `src/services/campaigns/`.
- `supabase/migrations/` — versioned PostgreSQL schema, RLS, and campaign RPC.
- `asset-library/` — staging/catalog metadata; downloaded originals are intentionally git-ignored.

Read `PROJECT_STATUS.md` for audited scope and phase-by-phase status.
