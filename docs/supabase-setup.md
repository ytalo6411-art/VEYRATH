# Supabase setup and security notes

The frontend uses only the Supabase project URL and its publishable/anon key. A service-role key must never be exposed to the browser.

## Apply the first migration

Apply `supabase/migrations/202611040001_initial_schema.sql` to the target project before enabling the Vite environment variables. The migration creates:

- `profiles`, linked to `auth.users`, with a profile-creation trigger.
- `campaigns` and `campaign_members`, with the creator automatically assigned the `master` role in the same database transaction.
- RLS policies for self profiles, campaign members, and campaign masters.
- `join_campaign_by_code`, an authenticated RPC that resolves an active invite and joins the user as a player.

The application must receive authorization errors rather than falling back to browser storage when cloud mode is configured. If the migration is missing, fix the database setup; do not treat the error as a successful save.

## Auth configuration

Enable email/password sign-in in Supabase Auth. Whether email confirmation is mandatory is controlled in the Supabase project settings; the UI handles both an immediate session and a confirmation-required response. Set the site's allowed redirect URLs for local development and the eventual deployment domain.

## RLS review

All three tables have RLS enabled. Campaign membership lookup used by policies goes through narrowly scoped `SECURITY DEFINER` predicates; the invite RPC derives the user from `auth.uid()` and never accepts a user ID from the browser. Campaign rows are visible only to members. Only campaign masters can update/delete campaign records. Direct client writes to membership roles are not granted by policy.

Review these policies against any future campaign fields before adding secret GM notes, unrevealed map data, character inventories, combat state, or rewards. Those must use separate access policies and server-validated operations; this initial schema does not implement them.

## Verify a project

1. Register a test account and confirm that one `profiles` row is created.
2. Create a campaign and confirm a matching `campaign_members` row has `role = 'master'`.
3. Join from a second authenticated test account using the invite code and confirm it receives `role = 'player'`.
4. Verify a non-member cannot select the campaign, and a player cannot update/delete it.
5. Inspect the browser network panel to ensure no service-role key is present.

Live-project verification is pending because this repository checkout has no Supabase project URL or credentials.
