# Supabase setup and security notes

The browser uses only the Supabase project URL and its publishable/anon key. A service-role key must never be exposed to the browser.

## Current project status

The dedicated project is `veyrath` (`ovzkleequlbacefjzduk`), on the Free plan in `sa-east-1`. All four migrations are applied:

1. `20261104234703_veyrath_initial_schema` — profiles, campaigns, memberships, RLS, creator trigger, and invite RPC.
2. `20261105161506_online_campaign_game` — characters, inventory, shared game state, activity events, server-authoritative RPCs, RLS, and Realtime publication entries.
3. `20261105161945_online_game_fixes` — safe one-item delivery under the positive inventory constraint and a recovery path for defeated characters.
4. `20261105162341_online_game_table_grants` — explicitly revokes Supabase default privileges on the four game tables and restores only authenticated SELECT grants.

Live metadata and privilege queries confirmed all four game tables exist with RLS enabled and are present in `supabase_realtime`. `anon` has no direct game-table read access or game-RPC execution grants. `authenticated` can read the RLS-scoped rows but has no direct table write grants; game mutations use RPCs. The core migration SQL and game operations were exercised in an isolated PostgreSQL WASM test database; this did not create test data or accounts in the live project.

There is no `.env.local` in the repository workspace. Configure one locally from `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The deployed Vercel project has these values configured in its environments. Email/password signup is enabled and email confirmation remains required. SMTP and redirect URLs should be reviewed before broad testing.

## Migrations

Apply migrations in timestamp order on a new project:

- `supabase/migrations/20261104234703_veyrath_initial_schema.sql`
- `supabase/migrations/20261105161506_online_campaign_game.sql`
- `supabase/migrations/20261105161945_online_game_fixes.sql`
- `supabase/migrations/20261105162341_online_game_table_grants.sql`

The second migration creates:

- `campaign_game_state` — one shared first-region state per campaign.
- `characters` — one account-owned character per campaign, including class, stats, position, quest state, and progression.
- `character_inventory` — persistent campaign character inventory.
- `campaign_game_events` — recent shared action/combat history.

Writes use authenticated `SECURITY DEFINER` RPCs: `create_campaign_character`, `move_campaign_character`, `accept_campaign_quest`, `attack_campaign_slime`, `deliver_campaign_quest`, `rest_campaign_character`, and `master_reset_campaign_region`. `get_campaign_game_snapshot` returns a validated campaign snapshot. Game functions derive the current account with `auth.uid()`, verify campaign membership (and master role where relevant), and serialize shared-world mutations through the campaign state row. Combat rolls and rewards are generated in PostgreSQL, not accepted from browser input.

## RLS and Realtime

All four game tables have RLS enabled. Campaign members can read shared region state, character positions/sheets, and campaign activity. Inventory is readable only by a member who owns the corresponding character. The fourth migration explicitly revokes Supabase default privileges from `PUBLIC`, `anon`, and `authenticated`, then grants `SELECT` only to `authenticated`. Direct inserts/updates/deletes for game state, characters, inventory, and events are not granted; mutations must use the RPCs. The anonymous role has no direct read grant or execution grant for the game RPCs.

The four game tables are included in the Supabase Realtime publication. The client subscribes to campaign-filtered changes and then reloads the authoritative RPC snapshot. RLS remains the access boundary; campaign IDs in client code are not treated as authorization.

The initial campaign schema still controls membership and invitations. `join_campaign_by_code` derives the joining user from `auth.uid()`; the browser does not choose a `user_id` or role.

## Local and production configuration

For local development:

```bash
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm ci
npm run dev
```

Partial Supabase configuration should stop with an error rather than silently falling back to local storage. The separate Local Workshop and local campaign preview are explicitly browser-local; they do not upload or adopt local saves into the cloud campaign.

Supabase Auth requires email confirmation in the current project. Add each exact Vite, preview, and production origin to the Auth redirect allow-list as appropriate. Do not disable email confirmation casually, and configure an SMTP sender before public sign-up testing.

The known production Vercel deployment is still on the pre-online-game commit and currently has SSO protection outside custom domains. A `READY` deployment is not proof of anonymous/public access. The online branch has not been deployed or publicly verified.

## Verification boundaries

Completed:

- Remote migration history and table/RLS/Realtime metadata checked through the Supabase connector.
- An isolated PostgreSQL WASM test applied the initial, online, and fixes SQL; it simulated two campaign members with separate spawns and shared snapshots, verified collision rejection, accepted the quest, resolved a D20 victory, delivered/consumed the shard, awarded XP, rested at camp, recovered a downed character, and reset the region without overlapping spawn positions.
- The application unit/component suite covers online snapshot validation, server RPC calls, error handling, local preview preservation, and character/quest UI flow.

Still pending:

1. Sign up with real email addresses and complete confirmation for two real accounts.
2. Create a cloud campaign with account A, join it from account B using the invite code, and verify the two-account member/RLS boundary.
3. Enter the online region from both accounts and check that movement, quest state, combat, inventory, and Realtime updates match.
4. Run the Playwright browser smoke test and visually inspect desktop/mobile. Chromium is not installed in this workspace.
5. Deploy the updated branch and review the Vercel SSO/public-access configuration before telling players they can access it anonymously.
