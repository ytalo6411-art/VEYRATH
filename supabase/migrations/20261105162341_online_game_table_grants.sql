-- Supabase default privileges can grant broad table access to anon/authenticated.
-- Revoke them explicitly and restore member-only reads; all writes remain RPC-only.

revoke all privileges on table
  public.campaign_game_state,
  public.characters,
  public.character_inventory,
  public.campaign_game_events
from public, anon, authenticated;

grant select on table
  public.campaign_game_state,
  public.characters,
  public.character_inventory,
  public.campaign_game_events
to authenticated;
