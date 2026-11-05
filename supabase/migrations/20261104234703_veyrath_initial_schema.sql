-- VEYRATH Phase 1: authenticated profiles and campaign membership.
-- Apply this migration to a Supabase project before enabling cloud mode.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  created_by uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('master', 'player')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index if not exists campaigns_created_by_created_at_idx
  on public.campaigns (created_by, created_at desc);
create index if not exists campaign_members_user_joined_idx
  on public.campaign_members (user_id, joined_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_name text;
begin
  requested_name := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(requested_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Aventureiro'), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Keep the trigger safe to re-apply in a development project.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members as member_row
    where member_row.campaign_id = p_campaign_id
      and member_row.user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_master(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members as member_row
    where member_row.campaign_id = p_campaign_id
      and member_row.user_id = auth.uid()
      and member_row.role = 'master'
  );
$$;

revoke all on function public.is_campaign_member(uuid) from public;
revoke all on function public.is_campaign_master(uuid) from public;
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_master(uuid) to authenticated;

create or replace function public.add_campaign_creator_as_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.created_by, 'master');
  return new;
end;
$$;

create trigger campaigns_add_creator_as_master
after insert on public.campaigns
for each row execute function public.add_campaign_creator_as_master();

create or replace function public.join_campaign_by_code(p_invite_code text)
returns table (campaign_id uuid, campaign_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  matched_campaign_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select campaign.id
    into matched_campaign_id
    from public.campaigns as campaign
   where campaign.invite_code = upper(btrim(p_invite_code))
     and campaign.status = 'active';

  if matched_campaign_id is null then
    raise exception 'Invite code is invalid or the campaign is inactive' using errcode = 'P0001';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (matched_campaign_id, current_user_id, 'player')
  on conflict (campaign_id, user_id) do nothing;

  return query
    select campaign.id, campaign.name, member_row.role
      from public.campaigns as campaign
      join public.campaign_members as member_row
        on member_row.campaign_id = campaign.id
     where campaign.id = matched_campaign_id
       and member_row.user_id = current_user_id;
end;
$$;

revoke all on function public.join_campaign_by_code(text) from public;
grant execute on function public.join_campaign_by_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

-- Profiles are private to the account in the foundation phase. A later social/profile
-- feature must define an explicit campaign-scoped read policy before exposing names.
create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "campaigns_select_members"
  on public.campaigns for select to authenticated
  using (public.is_campaign_member(id));

create policy "campaigns_insert_as_creator"
  on public.campaigns for insert to authenticated
  with check (created_by = auth.uid());

create policy "campaigns_update_masters"
  on public.campaigns for update to authenticated
  using (public.is_campaign_master(id))
  with check (public.is_campaign_master(id));

create policy "campaigns_delete_masters"
  on public.campaigns for delete to authenticated
  using (public.is_campaign_master(id));

create policy "campaign_members_select_campaign_members"
  on public.campaign_members for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- Do not grant direct membership writes. Campaign creation uses the owner trigger;
-- joining uses the SECURITY DEFINER RPC above.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select on public.campaign_members to authenticated;
