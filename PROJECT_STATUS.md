# VEYRATH — project status

**Audit date:** 2026-11-04 (UTC)
**Branch:** `arena/f62bac8a-veyrath`
**Baseline:** `cda9a28009c210b3e3520142894a9ac9e11f7b0b` (`Initial commit`)

## 1. Initial audit

The checkout initially contained only `README.md` (nine bytes) and the Git metadata. There was no package manifest, application source, test suite, database schema/migrations, Supabase configuration, asset library, or deployment configuration. No existing application behavior or user-created code needed preservation. The initial branch was clean.

Environment observed during audit: Node.js `v22.22.3`, npm `10.9.8`. Dependency compatibility was checked against the npm registry before setup: Vite `8.3.5` supports the available Node runtime; React `19.3.1`; Phaser `3.90.0` (Phaser 3 as specified); Supabase JS `2.119.0`; Vitest `5.1.0`; TypeScript `5.9.3`. The app pins Phaser to major 3 and separates Phaser from React UI/state.

No Supabase project URL or key was present in the checkout. The connected Supabase account lists projects, but none is named for Veyrath; I left those unrelated projects untouched and did not create a new cloud resource. Consequently, cloud auth, RLS, realtime, and persistent cloud writes cannot truthfully be marked live-tested in this checkout.

## 2. Phase 1 delivery

| Area | Status | Notes |
|---|---|---|
| React + TypeScript + Vite | Complete | Strict TS configuration, production build, responsive UI. |
| Phaser 3 boundary | Scaffolded | Runtime factory and pixel-art defaults are present; no playable map is claimed yet. |
| Supabase client/auth | Implemented, awaiting project config | Real email/password sign-up/sign-in and session restoration activate when environment variables exist. |
| PostgreSQL foundation | Implemented, awaiting deployment | Versioned migration for profiles, campaigns, memberships, RLS, and invite join RPC. |
| Campaign dashboard | Implemented | Create/list/select campaigns; cloud path uses Supabase. |
| Local workshop | Implemented and labelled | Local-only campaign data is stored in this browser's localStorage. It is not multiplayer, cloud persistence, or auth. |
| Asset research/catalog | Started | No assets downloaded or approved; details in `ASSET_REPORT.md`. Catalog and manifest schemas are present. |
| Tests | Unit + E2E smoke authored | 7 Vitest checks pass, including a React campaign-create/reload flow. Typecheck and build pass. The Playwright test is authored but could not launch because Chromium is not installed in this sandbox; live Supabase tests await credentials. |

## 3. Current implementation map

```text
src/app/                 React auth gate, dashboard, campaign dialogs/details
src/services/auth/       Supabase email/password operations
src/services/campaigns/  Cloud campaign service, local-only storage, validation
src/services/supabase/   Typed Supabase client
src/game/                Phaser 3 runtime boundary and pixel-art defaults
src/engine/              Reserved for rule modules; no combat rules claimed yet
supabase/migrations/   Profiles, campaigns, memberships, RLS, invite RPC
asset-library/          Staging structure; no downloaded source package
asset-*.json             Empty approved manifest/catalog plus source audit
 tests/                  Vitest domain/UI tests and Playwright smoke test
```

## 4. Functional boundaries and known gaps

- Cloud mode is selected only when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are supplied. Apply the SQL migration first. The UI must surface cloud errors; it must not silently write to local storage as a substitute.
- Local Workshop intentionally offers no account, cross-device invite, realtime, or multiplayer simulation. Its campaigns persist only in the current browser profile.
- Supabase migrations establish account/campaign access only. They do not yet include characters, inventory, maps, quests, combat, chat, Realtime publication, edge functions, or private GM notes.
- No gameplay map, assets, character creator, combat rules, or AI narrator is claimed complete.
- A production Supabase instance and credentials were not available; database migration application and two-user RLS tests remain pending.
- The requested third-party asset packages were not downloaded. See the license/access audit and next steps in `ASSET_REPORT.md`.

## 5. Realistic next phases

1. **Phase 1 — foundation (this pass):** finish the application scaffold, real campaign/auth contracts, initial migration, honest local workshop, setup docs, status report, and runnable quality checks.
2. **Phase 2 — assets:** manually obtain small candidate packs, audit each package's original license and source, validate perspective/frame geometry, generate previews, then approve only selected files into the manifest.
3. **Phase 3 — characters:** data-driven races/classes, character record, modular appearance only where source sprites actually align, and persistent inventory/appearance tables with RLS.
4. **Phase 4 — exploration:** one finite region, logical isometric coordinates, collision, interaction, and region loading; validate against audited art.
5. **Phase 5 — rules/combat:** pure D20 engine with unit tests, then server-validated transactional actions and tactical map state.
6. **Phase 6 — multiplayer:** campaign event sequence, Realtime delivery, recovery snapshots, presence/chat, and two-user reconnect tests. Realtime is not a source of truth.
7. **Phase 7 — GM/quests:** private GM content, missions, encounters, and carefully scoped RLS.
8. **Phase 8 — polish/release:** browser/device tests, performance/security audit, deployment, and operational documentation.

A live, shared campaign should not be represented as complete until the cloud configuration, two-user authorization, persistence, and reconnect acceptance tests pass.

## 6. How to verify this phase

```bash
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` after installing Chromium with Playwright. For cloud verification, follow `docs/supabase-setup.md` and test with two distinct authenticated accounts.
