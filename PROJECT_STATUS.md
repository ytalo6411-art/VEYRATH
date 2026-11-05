# VEYRATH — project status

**Status updated:** 2026-11-05
**Working branch:** `arena/1adbbae1-veyrath` (**active**)
**Branch base:** `1678006674ded1d75f0f32e290014be4a94293ad` (`main`)

## 1. Summary

The project now has a playable **online RPG vertical slice** for cloud campaigns, alongside the preserved browser-local solo preview. Cloud campaign game state is stored in Supabase. Authenticated database RPCs validate movement, campaign membership, quest actions, combat rolls/rewards, rests, and the GM region reset. Campaign members see shared characters and Realtime updates.

This is the first 13 × 11 region and one quest/encounter—not a finished multi-region RPG. Real two-account gameplay and browser visual QA are still pending.

## 2. Supabase and deployment

- Supabase project: `veyrath` (`ovzkleequlbacefjzduk`), Free, `sa-east-1`, currently `ACTIVE_HEALTHY`.
- Migrations `20261104234703_veyrath_initial_schema`, `20261105161506_online_campaign_game`, `20261105161945_online_game_fixes`, and `20261105162341_online_game_table_grants` are applied and recorded remotely; local filenames match the live versions.
- Live metadata query confirmed `campaign_game_state`, `characters`, `character_inventory`, and `campaign_game_events` all exist with RLS enabled and are in `supabase_realtime`. `anon` has no direct table read or game-RPC write access; `authenticated` has campaign-scoped reads and no direct table writes. The online migrations created no character, game-state, or event rows.
- Email/password signup is enabled, email confirmation is required, and Supabase Auth redirects are configured for the known Vite/sandbox/production origins. No real sign-up or email-confirmation test has been done.
- No `.env.local` exists in this checkout. Vercel's project environments already have the Supabase URL and publishable key; no service-role key is used by frontend code.
- Known production deployment: `https://veyrath-woad.vercel.app`, deployment `dpl_9Za74Eci2T8s9ksTPWBagSRN753y`, `READY`, still on the pre-online-game commit. Vercel's protection remains SSO (`private: true`, `all_except_custom_domains`), so this does not mean unrestricted public access. The active working branch has not been deployed.

## 3. Online campaign RPG

The online entry is available separately from the local preview on each cloud campaign.

- **Characters:** one per account and campaign; Guardian, Ranger, or Arcanist; server-assigned stats, spawn position, level, XP, HP/defense, quest state, and inventory.
- **Shared region:** persistent world HP/revision, collision-aware player movement, distinct available spawn tiles, and other party members drawn in the isometric Phaser scene.
- **Quest:** campaign quest to accept Lira's request, defeat the marsh slime, recover its amber shard, return to Lira, and receive XP/progression.
- **Combat:** D20 attack/defense, damage, critical hits, slime response, death/resting, victory, and shared loot are resolved and recorded by PostgreSQL. The browser does not submit rolls or rewards.
- **GM tool:** campaign master can reset the first region for everyone. It restores the encounter and positions, clears this region's item/quest state, and preserves earned XP.
- **Shared log and status:** recent actions, party status, inventory, health, positions, and quest progress refresh through Supabase Realtime and authoritative snapshots.

All game-table RLS policies are enabled. Authenticated clients can read permitted campaign rows but have no direct write grants to game-state tables. Game writes use membership-checked `SECURITY DEFINER` RPCs. Inventory visibility is limited to a member's own character.

## 4. Preserved local preview

The earlier single-player experience remains in its own path:

- Finite 13 × 11 isometric *Clareira da Vigília*, terrain/prop collisions, WASD/arrow/on-screen movement, Lira, the quest, D20 encounter, inventory, XP, and camp rest.
- Progress uses browser `localStorage` under a campaign-scoped key. It is not cloud-saved, cross-device, multiplayer, or server-authoritative.
- Cloud campaign detail offers **Entrar na mesa online** and **Abrir prévia local** as separate actions. Local progress does not overwrite or migrate into Supabase.
- When unauthenticated, the separately labelled Local Workshop preview is still available; it does not create an account or a cloud campaign.

Prototype visuals use Phaser Graphics only. No third-party art was copied or licensed; see `ASSET_REPORT.md`, `asset-catalog.json`, and `asset-licenses.json`.

## 5. Verification

- `npm ci`: 112 packages installed; 0 reported vulnerabilities.
- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: **27 tests passed across 11 files**, including local adventure/save tests, service snapshot/RPC validation, online character/quest UI flow, and downed-character recovery UI.
- `npm run build`: passed. Vite's default large-chunk warning is for Phaser (~1.19 MB minified / 318 KB gzip); the initial UI chunk is ~485 KB minified.
- The SQL migrations were applied in an isolated PostgreSQL WASM database for local validation. The test simulated two campaign members with distinct spawns and shared snapshots, rejected a collision, accepted the quest, resolved a D20 victory, delivered and consumed the shard, awarded 40 XP, tested camp rest and downed-character recovery, and reset the region. This was not an interactive test against real Supabase accounts.
- Playwright E2E/visual inspection: **not run successfully** because the Chromium binary is not installed in this workspace.
- Real email confirmation, joining with a second account, and two-browser Realtime gameplay: **pending**.

## 6. Implementation map

```text
src/app/                         Auth, dashboard, cloud/local adventure entries
src/app/pages/OnlineAdventurePage.tsx  Cloud character, adventure, combat, and GM UI
src/game/scenes/FirstRegionScene.ts    Shared-region Phaser rendering and local preview scene
src/services/game/onlineAdventureService.ts  RPC calls, snapshot validation, Realtime
src/services/game/                    Browser-local adventure save
src/services/campaigns/               Supabase campaigns and local campaigns
supabase/migrations/                  Campaign foundation and online RPG schema/RPCs/RLS
src/types/database.ts                Generated-style Supabase tables/function types
tests/                                Vitest unit/UI and Playwright smoke test
asset-library/                        Asset staging; downloads intentionally git-ignored
```

## 7. Remaining work and constraints

1. Use two real confirmed accounts: create a cloud campaign, join by invite, and verify both players can see only the authorized shared state.
2. Play from two browsers/devices and verify Realtime movement, collision rejection, quest/loot flow, combat, recovery, and GM reset.
3. Install Playwright Chromium and run `npm run test:e2e`; visually inspect desktop and mobile layouts/canvas.
4. Review/optimize the large Phaser chunk before broader distribution.
5. Expand the content and GM tools beyond the initial region before describing Veyrath as a complete multi-region RPG.
6. Deploy the active branch only after the live two-account/browser QA, and explicitly review Vercel's SSO/public-access choice. The current production deployment still serves the older application and is SSO protected.

## 8. Quality commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e  # requires Chromium installed with Playwright
```
