# Supabase setup and security notes

The frontend uses only the Supabase project URL and its publishable/anon key. A service-role key must never be exposed to the browser.

## Current project status

A dedicated Supabase project named `veyrath` is provisioned on the Free plan in `sa-east-1` (project ref `ovzkleequlbacefjzduk`). Migration `veyrath_initial_schema` (version `20261104234703`) is applied. The `profiles`, `campaigns`, and `campaign_members` tables exist with RLS enabled; the deployed policies were queried and verified.

This workspace has a local `.env.local` with the project URL and a publishable key. The file is ignored by Git and must not be committed. No service-role key is used by the Vite app. The current Auth configuration enables email/password and signup, keeps email confirmation required, and allows the current local Vite and sandbox-preview redirect URLs. Add the final production domain to the allow-list before deployment.

## Migration contents

The initial migration creates:

- `profiles`, linked to `auth.users`, with a profile-creation trigger.
- `campaigns` and `campaign_members`, with the creator automatically assigned the `master` role in the same database transaction.
- RLS policies for self profiles, campaign members, and campaign masters.
- `join_campaign_by_code`, an authenticated RPC that resolves an active invite and joins the user as a player.

The application must surface authorization errors rather than falling back to browser storage when cloud mode is configured. If a fresh project does not have the migration, apply `supabase/migrations/20261104234703_veyrath_initial_schema.sql` once; do not treat an error as a successful save.

## Auth configuration

Email/password sign-in is enabled, signup is allowed, and email confirmation is required. The client sends the current origin as the confirmation redirect, so the origin must be on the Supabase allow-list. The built-in email service has provider limits; configure a suitable SMTP sender before broader public testing. This project has not been tested with a real user account in this workspace.

## RLS review

All three application tables have RLS enabled. Campaign membership lookup used by policies goes through narrowly scoped `SECURITY DEFINER` predicates; the invite RPC derives the user from `auth.uid()` and never accepts a user ID from the browser. Campaign rows are visible only to members. Only campaign masters can update/delete campaign records. Direct client writes to membership roles are not granted by policy.

Review these policies against future campaign fields before adding secret GM notes, unrevealed map data, character inventories, combat state, or rewards. Those need separate access policies and server-validated operations; this initial schema does not implement them.

## Current gameplay boundary

The Phaser first-region preview is an explicitly local solo prototype. Its movement, D20 encounter, quest, inventory, and progression are handled in the browser and saved in `localStorage` per campaign. None of those game actions or saves are written to Supabase or validated by a server, even when the campaign itself is cloud-backed. Treat it only as a local preview; do not imply cross-device persistence, multiplayer, or trusted rewards.

## Remaining live verification

1. Sign up with a real email in the Veyrath app and confirm the email.
2. Create a campaign and confirm a matching `campaign_members` row has `role = 'master'`.
3. Sign in with a second real account, join using the invite code, and confirm it receives `role = 'player'`.
4. Verify a non-member cannot select the campaign and a player cannot update/delete it.
5. Inspect the browser network panel to ensure no service-role key is present.

Migration and RLS metadata have been verified through the Supabase connector, but these two-account interaction tests are still pending. The Playwright Chromium binary is not installed in this workspace, and no test accounts were created.
