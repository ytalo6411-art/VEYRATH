# VEYRATH

Veyrath is a browser-based fantasy RPG and shared campaign workspace. Cloud campaigns now have a playable online first-region adventure with persistent character sheets, shared exploration, server-validated actions, and Realtime updates. The separate solo preview remains browser-local by design.

## Current status

- **Supabase project:** `veyrath` (`ovzkleequlbacefjzduk`), Free plan, `sa-east-1`. The campaign foundation and three online-game migrations are applied (`20261104234703`, `20261105161506`, `20261105161945`, `20261105162341`).
- **Online adventure:** a 13 × 11 isometric region, *Clareira da Vigília*, with Guardian, Ranger, and Arcanist characters; shared party positions; Lira's campaign quest; server-rolled D20 combat against the marsh slime; inventory, XP, resting, activity log, and a master-only region reset.
- **Server authority:** game writes go through authenticated PostgreSQL RPCs. The server validates membership, movement and collisions, interaction distance, quest progression, combat, rewards, resting, and master reset. Members can read only their campaign's game rows through RLS; browser clients have no direct write grants for game state.
- **Realtime:** campaign state, character changes, and game events are published for Supabase Realtime; each member's read access is still scoped by RLS.
- **Local preview:** `Abrir prévia local` keeps the original solo prototype and its `localStorage` save separate from cloud game state. It does not upload, replace, or share that save.
- **Live verification:** all four game tables exist with RLS enabled and are in Realtime. Live privilege checks confirmed `anon` has no direct game-table read or RPC-write access; `authenticated` has campaign-scoped reads but no direct table writes and can use the authenticated RPCs. The online migrations created no player/game rows. The SQL was exercised in an isolated PostgreSQL WASM test database: two simulated members, unique spawns, a server-rejected collision, quest acceptance, D20 victory, shard delivery/consumption, XP, camp rest, downed-character recovery, and master reset. Real email sign-up/confirmation and two real accounts playing together still need a hands-on test.
- **Production boundary:** the currently known Vercel deployment (`dpl_9Za74Eci2T8s9ksTPWBagSRN753y`) is still on the pre-online-game commit. It is protected by Vercel SSO outside custom domains; `READY` does not mean it is publicly accessible. This working branch has not been deployed.
- **Assets:** no third-party art has been copied into the game. The first-region visuals are drawn with Phaser primitives. See `ASSET_REPORT.md`, `asset-catalog.json`, and `asset-licenses.json` before importing external packs.

The workspace does not contain a local `.env.local`. A fresh checkout must supply its own Supabase URL and **publishable/anon** key. Never put a service-role key in frontend code.

## Run locally

Requirements: Node.js 22.22.2+ and npm.

```bash
npm ci
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Supabase email/password sign-up is enabled and email confirmation is required. After signing in, create a cloud campaign or join using its invite code, open the campaign, and choose **Entrar na mesa online**. Create one character per account and campaign. Use WASD/arrow keys or the on-screen controls; interact with nearby Lira, the slime, and camp with E or the action button. Game saves are associated with the signed-in account and campaign.

To try the separate solo prototype, choose **Abrir prévia local**. Its save is scoped to this browser and campaign; clearing browser storage or switching devices loses access to that local save. Local preview progress is never treated as a Supabase save.

## Supabase setup

For a new Supabase project, apply the migrations in order:

1. `supabase/migrations/20261104234703_veyrath_initial_schema.sql` — profiles, campaigns, members, campaign RLS, and invite RPC.
2. `supabase/migrations/20261105161506_online_campaign_game.sql` — character sheets, inventory, shared region state, event log, RLS, server-authoritative game RPCs, and Realtime publication entries.
3. `supabase/migrations/20261105161945_online_game_fixes.sql` — safe inventory delivery and recovery for defeated characters.
4. `supabase/migrations/20261105162341_online_game_table_grants.sql` — explicitly removes Supabase default game-table grants, then restores authenticated member-only reads; writes stay RPC-only.

Then set `VITE_SUPABASE_URL` and the **publishable/anon** key in `.env.local`. Email confirmation is required; configure SMTP and allowed redirect URLs for the domain used to play. Never expose the Supabase service-role key. See [`docs/supabase-setup.md`](docs/supabase-setup.md) for the security model and verification boundaries.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Current checks: TypeScript typecheck passed; all 27 Vitest tests across 11 files passed; production build passed. Vite warns that the Phaser bundle is larger than its default size threshold (about 1.19 MB minified / 318 KB gzip); the initial UI chunk is about 485 KB. The Playwright smoke test requires Chromium installed with `npx playwright install chromium`; that browser binary is not installed in this workspace, so E2E and hands-on visual testing remain pending.

## Project map

- `src/app/` — authentication, campaign dashboard, online adventure, and separate local preview.
- `src/services/campaigns/` — cloud campaign and browser-local campaign flows.
- `src/services/game/onlineAdventureService.ts` — authenticated RPC calls, snapshot validation, and Realtime subscription.
- `src/game/` — Phaser runtime, first-region data, and isometric scene.
- `src/engine/` — existing pure D20 rules and local-preview encounter logic.
- `supabase/migrations/` — PostgreSQL schema, RLS policies, server-authoritative game operations, and Realtime publication setup.
- `tests/` — Vitest unit/component coverage and a Playwright smoke test.
- `asset-library/` — asset staging/catalog metadata; downloaded originals are intentionally git-ignored.

## Scope note

The online campaign is a playable, server-authoritative vertical slice of the first region—not a finished multi-region commercial RPG. It currently contains one quest, one enemy encounter, three starting classes, and a master reset tool. More regions, content, advanced GM authoring tools, real two-account testing, and a public deployment review remain future work. See `PROJECT_STATUS.md` for the audited scope.
