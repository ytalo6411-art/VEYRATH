# VEYRATH — project status

**Status updated:** 2026-11-04
**Working branch:** `arena/780bfdfd-veyrath`
**Branch base:** `1485ba5e1ac902b31277d114dbe1a5587e0324fa` (`main`)

## 1. Initial audit

When Phase 1 began, the repository contained only `README.md` and Git metadata. The React/Vite application, tests, migrations, Supabase integration, project documentation, and asset audit were added in PR #1. No third-party art was downloaded.

Environment observed: Node.js `v22.22.3`, npm `10.9.8`. Current packages include React `19.3.1`, Phaser `3.90.0`, Supabase JS `2.119.0`, Vitest `5.1.0`, and TypeScript `5.9.3`.

## 2. Phase 1 cloud setup

A dedicated Supabase project was provisioned after the user freed a free-tier project slot:

- Project: `veyrath` (`ovzkleequlbacefjzduk`), Free plan, `sa-east-1`.
- Auth, database, REST, Realtime, Storage, and pooler reported healthy during setup.
- Migration `veyrath_initial_schema` was applied; Supabase migration version: `20261104234703`.
- `profiles`, `campaigns`, and `campaign_members` exist with RLS enabled. Policies and the migration record were verified through the Supabase connector.
- Email/password signup is enabled and email confirmation remains required. Redirect URLs include local Vite and this sandbox preview.
- This workspace has `.env.local` with the project URL and a **publishable** key. It is git-ignored. No service-role key is in the frontend or repository.

No real account has been created or used for an interactive sign-up, email confirmation, campaign creation, or two-account authorization test. Playwright's Chromium binary is absent, so the authored browser smoke test could not be run here.

## 3. First playable vertical slice — local solo preview

The previous Phaser scaffold has been connected to a small playable adventure:

- A finite **13 × 11** isometric region, *Clareira da Vigília*, with grass, a stone path, marsh water, rocks, trees, an encampment, Lira, the player, and one slime. Prototype visuals are drawn with Phaser Graphics; no unverified external sprites or licenses were introduced.
- Movement with WASD/arrow keys and on-screen directional controls. Region bounds, water, rocks, and trees block movement; interaction with nearby targets is available by E or button.
- Lira can give a quest to defeat the slime and return an amber shard. The encounter includes initiative, D20 attack rolls, defense/AC, critical hits, damage, enemy turns, victory/defeat, XP, item reward, and camp rest.
- Region position, HP, quest state, slime HP, inventory, XP, and update timestamp are saved under a browser `localStorage` key scoped to campaign ID. Corrupt/unreadable saves are not overwritten automatically.
- The progression above is **browser-local only**, including when opened from a cloud campaign. It is not Supabase game state, cross-device sync, multiplayer, or server-authoritative combat. The cloud campaign/account/invitation path remains unchanged.
- If Supabase is configured and the visitor is unauthenticated, the auth page offers **“Jogar prévia local sem conta”**. It enters a separately labelled Local Workshop. Users can return to the cloud login. If Supabase is absent, Local Workshop opens directly.

## 4. Feature status

| Area | Status | Notes |
|---|---|---|
| React + TypeScript + Vite | Complete | Strict typecheck, responsive dashboard, production build. |
| Supabase Auth | Configured, not user-tested | Email/password enabled; confirmation required; interactive signup is pending. |
| PostgreSQL foundation | Deployed | Profiles, campaigns, members, RLS, creator trigger, invite RPC applied and verified. |
| Campaign dashboard | Implemented | Cloud creation/list/invite use Supabase; local campaigns remain browser-only. |
| Solo exploration preview | Playable local slice | Finite isometric region, movement, basic collisions, interactions, local campaign-scoped save. |
| D20 combat and quest | Playable local prototype | Client-side only; not trusted for competitive or shared cloud state. |
| Asset research/catalog | Started | No third-party assets downloaded or approved; see `ASSET_REPORT.md`. |
| Unit/component tests | Passing | 22 Vitest checks across 9 files; includes region reachability, storage, D20 encounter, full local quest/reward UI flow and offline-entry checks. |
| Browser E2E | Authored, pending execution | `tests/e2e/campaign-flow.spec.ts` covers local preview, canvas, movement save; needs Playwright Chromium. |
| Two-account cloud test | Pending | Requires two real confirmed accounts and interactive verification. |

## 5. Implementation map

```text
src/app/                 Auth gate, explicit offline-preview option, dashboard, game UI
src/engine/rules/        Pure D20 roll/attack resolution
src/engine/combat/       First encounter initiative and turn state
src/game/world/          Finite Clareira da Vigília region data
src/game/scenes/         Phaser isometric terrain, props, movement, collisions, interactions
src/services/game/       Campaign-scoped local adventure save
src/services/campaigns/  Supabase cloud campaigns and browser-local campaigns
src/services/auth/       Supabase email/password operations
supabase/migrations/     Profiles, campaigns, memberships, RLS, invite RPC
asset-library/           Staging structure; no downloaded source package
asset-*.json             Asset catalog/manifest and license audit
tests/                   Vitest unit/UI checks and Playwright smoke test
```

## 6. Boundaries and known gaps

- Supabase cloud mode activates only when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are supplied. Partial configuration stops with an error rather than silently writing locally.
- The explicit unauthenticated preview creates/uses local campaigns only. It does not create an account or copy local adventure state into Supabase.
- Local adventure persistence depends on this browser's storage. Clearing browser data or switching browsers/devices will not carry the save over.
- The deployed schema still has no character, map, quest, inventory, or combat persistence. Game actions are not validated by a server; multiplayer/realtime game events and GM secrets are not implemented.
- No real user has signed up, and RLS has not been tested across two authenticated accounts.
- Playwright Chromium is absent. The E2E test was attempted but stopped before launch because its Chromium executable is missing; no hands-on browser visual or full gameplay test is claimed.
- Production build succeeds and code-splits Phaser into a lazy chunk (~1.19 MB minified / 318 KB gzip). Vite still reports its default >500 KB chunk-size warning (main chunk ~507 KB); this is a warning, not a build failure.
- No third-party assets were downloaded. Source/licensing probes that failed and unverified sources are documented in `ASSET_REPORT.md`.

## 7. Next steps

1. Run `npm run test:e2e` once Chromium is available; visually test desktop/mobile canvas layout, region movement/collision, Lira's quest, slime victory/defeat, reward and save restoration.
2. Complete real Supabase signup/email-confirmation, campaign creation and two-account invite/member RLS tests. Keep cloud errors distinct from local preview.
3. Decide on compatible art packs and audit each exact asset/license before replacing prototype Graphics.
4. Design server-validated game actions and schema for character/quest/inventory/map state before representing any gameplay as cloud-saved or multiplayer.
5. Expand carefully into shared-world snapshots/reconnection, GM-only secrets, and deployment only after the single-player slice and security boundaries are verified.

## 8. Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e  # requires Chromium installed with Playwright
```
