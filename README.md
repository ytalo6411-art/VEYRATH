# VEYRATH

Veyrath is an original browser-based fantasy RPG in active development. The campaign workspace is backed by Supabase when configured, and a first **solo, browser-local gameplay preview** is now playable.

## Current state

- **Cloud mode:** a dedicated Supabase Free project (`veyrath`, `ovzkleequlbacefjzduk`, `sa-east-1`) is configured for this workspace. The initial schema/RLS migration is applied. Email/password signup is enabled and requires email confirmation.
- **Campaigns:** cloud campaign creation/listing and invitation join use Supabase. No real-account signup or two-account invite test has yet been completed.
- **Playable preview:** the finite 13 × 11 isometric *Clareira da Vigília* includes WASD/arrow movement, terrain/prop collisions, Lira's quest, a D20 slime encounter, reward/inventory, resting, and a per-campaign save.
- **Local-only progress:** gameplay state is saved in this browser's `localStorage`, whether the campaign record itself is local or cloud. It is not synchronized, multiplayer, or validated by a game server. Cloud campaign/account data remains on the Supabase path; the preview does not silently replace it.
- **Offline access:** when Supabase is configured but the visitor is not signed in, the auth page offers **“Jogar prévia local sem conta”**. It enters a separately labelled Local Workshop, not a cloud account. When Supabase is absent, Local Workshop opens directly.
- **Assets:** no third-party art has been copied into the game. The first-region visuals are drawn with Phaser primitives for this prototype. See `ASSET_REPORT.md`, `asset-catalog.json`, and `asset-licenses.json` before importing external packs.

The active workspace has a `.env.local` containing the Supabase URL and a publishable browser key. It is git-ignored and is not included in this repository. A fresh clone must configure its own `.env.local`; never put a service-role key in frontend code.

## Run and play locally

Requirements: Node.js 22.22.2+ (tested here with 22.22.3) and npm.

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. With no Supabase configuration, create a campaign in Local Workshop. With cloud configuration, sign in normally or choose **“Jogar prévia local sem conta”** to try the local prototype without creating an account. Then create/open a campaign and select **“Jogar prévia”**. Use WASD/arrow keys or the on-screen controls; press E (or the interaction button) near Lira, the slime, or camp.

The adventure save key is scoped to the campaign in this browser. Clearing browser storage or changing browser/device loses access to that local progress. It does not alter or stand in for Supabase game persistence.

## Supabase setup for a new checkout

This workspace's dedicated project already has `supabase/migrations/20261104234703_veyrath_initial_schema.sql` applied. In a new checkout:

1. Use the dedicated Veyrath Supabase project, or create a separate project on a plan appropriate for your use.
2. If the migration is not yet applied, apply `supabase/migrations/20261104234703_veyrath_initial_schema.sql` once.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and the **publishable/anon** key from Supabase. Never use the service-role key in the frontend.
4. The project has email/password auth enabled, email confirmation required, and local/sandbox redirect URLs configured. Add the deployment domain to Supabase Auth's redirect allow-list when deploying.
5. Restart Vite. Both Supabase variables enable the real sign-in/sign-up flow; partial configuration intentionally stops rather than silently writing locally.

See [`docs/supabase-setup.md`](docs/supabase-setup.md) for RLS and verification status. The schema and RLS are deployed and checked, but signup and the two-account campaign/invite flow have not yet been exercised with real users.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The Playwright smoke test exercises the local preview entry, region canvas, and local movement save. It requires Chromium installed with `npx playwright install chromium`; Chromium is not currently installed in this workspace. Unit tests and the production build do not require a cloud project. The build succeeds; Vite reports a default chunk-size warning for the UI and lazily loaded Phaser bundle.

## Project map

- `src/app/` — React auth, dashboard, campaign details, and local playable adventure UI.
- `src/services/` — Supabase campaign/auth paths and explicitly browser-local campaign/adventure storage.
- `src/game/` — Phaser runtime, finite-region data, and isometric scene.
- `src/engine/` — pure D20 and first-encounter rules; prototype combat is client-side only.
- `supabase/migrations/` — versioned PostgreSQL schema, RLS, and campaign RPC.
- `asset-library/` — staging/catalog metadata; downloaded originals are intentionally git-ignored.

The local slice is intentionally small; multiplayer, server-authoritative game actions, cloud persistence of map/quest/combat state, full character creation, and external art remain future work. Read `PROJECT_STATUS.md` for audited scope and phase-by-phase status.
