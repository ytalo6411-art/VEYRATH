-- VEYRATH online RPG slice: persistent characters, shared world, server-resolved actions and Realtime.
-- All writes go through SECURITY DEFINER RPCs; clients receive read-only table grants.

create table if not exists public.campaign_game_state (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  region_id text not null default 'clareira-da-vigilia' check (region_id = 'clareira-da-vigilia'),
  slime_hp integer not null default 7 check (slime_hp between 0 and 7),
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 24),
  character_class text not null check (character_class in ('guardian', 'ranger', 'arcanist')),
  level integer not null default 1 check (level between 1 and 20),
  experience integer not null default 0 check (experience >= 0),
  hp integer not null,
  max_hp integer not null,
  attack_bonus integer not null,
  defense integer not null,
  col integer not null default 2 check (col between 0 and 12),
  row integer not null default 8 check (row between 0 and 10),
  quest_status text not null default 'unstarted' check (quest_status in ('unstarted', 'active', 'completed')),
  state_version bigint not null default 0 check (state_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id),
  unique (campaign_id, id),
  check (max_hp between 1 and 100),
  check (hp between 0 and max_hp)
);

create index if not exists characters_campaign_position_idx
  on public.characters (campaign_id, row, col);
create index if not exists characters_campaign_updated_idx
  on public.characters (campaign_id, updated_at desc);

create table if not exists public.character_inventory (
  character_id uuid not null references public.characters (id) on delete cascade,
  item_id text not null check (item_id in ('amber-shard')),
  quantity integer not null check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (character_id, item_id)
);

create table if not exists public.campaign_game_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  character_id uuid references public.characters (id) on delete set null,
  event_type text not null check (event_type in (
    'character_created', 'moved', 'quest_accepted', 'combat', 'quest_completed', 'rested', 'region_reset'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists campaign_game_events_recent_idx
  on public.campaign_game_events (campaign_id, id desc);
create unique index if not exists campaign_game_events_character_created_once_idx
  on public.campaign_game_events (character_id)
  where event_type = 'character_created' and character_id is not null;

create or replace function public.is_character_campaign_member(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.characters as character_row
      join public.campaign_members as member_row
        on member_row.campaign_id = character_row.campaign_id
     where character_row.id = p_character_id
       and member_row.user_id = auth.uid()
  );
$$;

revoke all on function public.is_character_campaign_member(uuid) from public;
grant execute on function public.is_character_campaign_member(uuid) to authenticated;

alter table public.campaign_game_state enable row level security;
alter table public.characters enable row level security;
alter table public.character_inventory enable row level security;
alter table public.campaign_game_events enable row level security;

create policy "campaign_game_state_select_members"
  on public.campaign_game_state for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "characters_select_campaign_members"
  on public.characters for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "character_inventory_select_campaign_members"
  on public.character_inventory for select to authenticated
  using (public.is_character_campaign_member(character_id));

create policy "campaign_game_events_select_members"
  on public.campaign_game_events for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- The browser can read campaign game state, but cannot directly forge characters, inventory,
-- positions, combat results, rewards, quests, or event records.
grant select on public.campaign_game_state to authenticated;
grant select on public.characters to authenticated;
grant select on public.character_inventory to authenticated;
grant select on public.campaign_game_events to authenticated;

create or replace function public.first_region_is_walkable(
  p_campaign_id uuid,
  p_col integer,
  p_row integer,
  p_ignore_character_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tile_row text;
  v_tile text;
  v_slime_hp integer;
begin
  if p_col < 0 or p_col >= 13 or p_row < 0 or p_row >= 11 then
    return false;
  end if;

  v_tile_row := case p_row
    when 0 then 'ggggggggggggg'
    when 1 then 'gggggggggwwgg'
    when 2 then 'ggggggggwwrgg'
    when 3 then 'gggpppgggppgg'
    when 4 then 'ggggppggggggg'
    when 5 then 'gggppgggggggg'
    when 6 then 'ggppggggggggg'
    when 7 then 'ggppggggggggg'
    when 8 then 'ggppggggggggg'
    when 9 then 'ggppggggggggg'
    when 10 then 'ggggggggggggg'
    else ''
  end;
  v_tile := substr(v_tile_row, p_col + 1, 1);
  if v_tile in ('w', 'r') then
    return false;
  end if;

  -- Trees, rocks and Lira block movement. The slime tile opens after its defeat.
  if (p_col, p_row) in ((1, 1), (4, 1), (0, 4), (7, 1), (11, 4), (6, 8), (10, 7), (5, 3)) then
    return false;
  end if;
  if p_col = 10 and p_row = 2 then
    return false;
  end if;
  if p_col = 9 and p_row = 5 then
    select game_state.slime_hp into v_slime_hp
      from public.campaign_game_state as game_state
     where game_state.campaign_id = p_campaign_id;
    if coalesce(v_slime_hp, 7) > 0 then
      return false;
    end if;
  end if;

  if exists (
    select 1
      from public.characters as other_character
     where other_character.campaign_id = p_campaign_id
       and other_character.col = p_col
       and other_character.row = p_row
       and other_character.id is distinct from p_ignore_character_id
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.first_region_is_walkable(uuid, integer, integer, uuid) from public;

create or replace function public.get_campaign_game_snapshot(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
  v_inventory jsonb;
  v_players jsonb;
  v_events jsonb;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para abrir a mesa online.' using errcode = '28000';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception 'Você não é participante desta campanha.' using errcode = '42501';
  end if;

  insert into public.campaign_game_state (campaign_id)
  values (p_campaign_id)
  on conflict (campaign_id) do nothing;

  select * into v_world
    from public.campaign_game_state
   where campaign_id = p_campaign_id
   for share;
  select * into v_character
    from public.characters
   where campaign_id = p_campaign_id
     and user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'itemId', inventory.item_id,
    'quantity', inventory.quantity
  ) order by inventory.item_id), '[]'::jsonb)
    into v_inventory
    from public.character_inventory as inventory
   where inventory.character_id = v_character.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', player.id,
    'userId', player.user_id,
    'name', player.name,
    'characterClass', player.character_class,
    'level', player.level,
    'experience', player.experience,
    'hp', player.hp,
    'maxHp', player.max_hp,
    'attackBonus', player.attack_bonus,
    'defense', player.defense,
    'col', player.col,
    'row', player.row,
    'questStatus', player.quest_status,
    'stateVersion', player.state_version
  ) order by player.created_at, player.name), '[]'::jsonb)
    into v_players
    from public.characters as player
   where player.campaign_id = p_campaign_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'eventType', recent.event_type,
    'actorName', coalesce(actor_character.name, 'Mestre'),
    'payload', recent.payload,
    'createdAt', recent.created_at
  ) order by recent.id desc), '[]'::jsonb)
    into v_events
    from (
      select event_row.*
        from public.campaign_game_events as event_row
       where event_row.campaign_id = p_campaign_id
       order by event_row.id desc
       limit 12
    ) as recent
    left join public.characters as actor_character
      on actor_character.id = recent.character_id;

  return jsonb_build_object(
    'campaignId', p_campaign_id,
    'regionId', v_world.region_id,
    'world', jsonb_build_object(
      'slimeHp', v_world.slime_hp,
      'slimeDefeated', v_world.slime_hp = 0,
      'revision', v_world.revision,
      'updatedAt', v_world.updated_at
    ),
    'character', case when v_character.id is null then null else jsonb_build_object(
      'id', v_character.id,
      'userId', v_character.user_id,
      'name', v_character.name,
      'characterClass', v_character.character_class,
      'level', v_character.level,
      'experience', v_character.experience,
      'hp', v_character.hp,
      'maxHp', v_character.max_hp,
      'attackBonus', v_character.attack_bonus,
      'defense', v_character.defense,
      'col', v_character.col,
      'row', v_character.row,
      'questStatus', v_character.quest_status,
      'stateVersion', v_character.state_version
    ) end,
    'inventory', v_inventory,
    'players', v_players,
    'recentEvents', v_events
  );
end;
$$;

create or replace function public.create_campaign_character(
  p_campaign_id uuid,
  p_name text,
  p_character_class text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_max_hp integer;
  v_attack_bonus integer;
  v_defense integer;
  v_spawn_col integer;
  v_spawn_row integer;
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para criar um personagem.' using errcode = '28000';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception 'Você não é participante desta campanha.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    raise exception 'O nome do personagem precisa ter entre 2 e 24 caracteres.' using errcode = '22023';
  end if;

  case p_character_class
    when 'guardian' then v_max_hp := 18; v_attack_bonus := 3; v_defense := 14;
    when 'ranger' then v_max_hp := 14; v_attack_bonus := 4; v_defense := 13;
    when 'arcanist' then v_max_hp := 12; v_attack_bonus := 5; v_defense := 12;
    else raise exception 'Escolha uma classe válida.' using errcode = '22023';
  end case;

  insert into public.campaign_game_state (campaign_id)
  values (p_campaign_id)
  on conflict (campaign_id) do nothing;
  select * into strict v_world
    from public.campaign_game_state
   where campaign_id = p_campaign_id
   for update;

  select * into v_character
    from public.characters
   where campaign_id = p_campaign_id
     and user_id = v_user_id
   for update;
  if v_character.id is not null then
    return public.get_campaign_game_snapshot(p_campaign_id);
  end if;

  select candidate_col.col, candidate_row.row
    into v_spawn_col, v_spawn_row
    from generate_series(0, 12) as candidate_col(col)
    cross join generate_series(0, 10) as candidate_row(row)
   where public.first_region_is_walkable(p_campaign_id, candidate_col.col, candidate_row.row, null)
   order by abs(candidate_col.col - 2) + abs(candidate_row.row - 8), candidate_row.row, candidate_col.col
   limit 1;
  if v_spawn_col is null then
    raise exception 'A área inicial está cheia. O mestre deve reiniciar a região antes de novas entradas.' using errcode = 'P0001';
  end if;

  insert into public.characters (
    campaign_id, user_id, name, character_class, hp, max_hp, attack_bonus, defense, col, row
  ) values (
    p_campaign_id, v_user_id, v_name, p_character_class, v_max_hp, v_max_hp, v_attack_bonus, v_defense, v_spawn_col, v_spawn_row
  );

  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  select p_campaign_id, v_user_id, character_row.id, 'character_created',
         jsonb_build_object('name', character_row.name, 'characterClass', character_row.character_class)
    from public.characters as character_row
   where character_row.campaign_id = p_campaign_id
     and character_row.user_id = v_user_id
       and not exists (
       select 1 from public.campaign_game_events as event_row
        where event_row.character_id = character_row.id
          and event_row.event_type = 'character_created'
     )
  on conflict do nothing;

  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.move_campaign_character(p_campaign_id uuid, p_direction text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
  v_next_col integer;
  v_next_row integer;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para mover o personagem.' using errcode = '28000';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception 'Você não é participante desta campanha.' using errcode = '42501';
  end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id for update;
  if v_character.id is null then
    raise exception 'Crie um personagem antes de explorar a região.' using errcode = 'P0001';
  end if;
  if v_character.hp = 0 then
    raise exception 'Seu personagem precisa descansar antes de se mover.' using errcode = 'P0001';
  end if;

  v_next_col := v_character.col;
  v_next_row := v_character.row;
  case p_direction
    when 'up' then v_next_row := v_next_row - 1;
    when 'right' then v_next_col := v_next_col + 1;
    when 'down' then v_next_row := v_next_row + 1;
    when 'left' then v_next_col := v_next_col - 1;
    else raise exception 'Direção de movimento inválida.' using errcode = '22023';
  end case;

  if not public.first_region_is_walkable(p_campaign_id, v_next_col, v_next_row, v_character.id) then
    raise exception 'Esse caminho está bloqueado.' using errcode = 'P0001';
  end if;

  update public.characters
     set col = v_next_col,
         row = v_next_row,
         state_version = state_version + 1,
         updated_at = now()
   where id = v_character.id;
  update public.campaign_game_state
     set revision = revision + 1,
         updated_by = v_user_id,
         updated_at = now()
   where campaign_id = p_campaign_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (p_campaign_id, v_user_id, v_character.id, 'moved', jsonb_build_object('col', v_next_col, 'row', v_next_row));

  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.accept_campaign_quest(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
begin
  if v_user_id is null then raise exception 'Entre na sua conta para aceitar a missão.' using errcode = '28000'; end if;
  if not public.is_campaign_member(p_campaign_id) then raise exception 'Você não é participante desta campanha.' using errcode = '42501'; end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id for update;
  if v_character.id is null then raise exception 'Crie um personagem antes de aceitar missões.' using errcode = 'P0001'; end if;
  if abs(v_character.col - 5) + abs(v_character.row - 3) > 1 then
    raise exception 'Aproxime-se de Lira para conversar.' using errcode = 'P0001';
  end if;
  if v_character.quest_status <> 'unstarted' then
    return public.get_campaign_game_snapshot(p_campaign_id);
  end if;

  update public.characters
     set quest_status = 'active', state_version = state_version + 1, updated_at = now()
   where id = v_character.id;

  if v_world.slime_hp = 0 then
    insert into public.character_inventory (character_id, item_id, quantity)
    values (v_character.id, 'amber-shard', 1)
    on conflict (character_id, item_id) do update
      set quantity = least(99, public.character_inventory.quantity + 1), updated_at = now();
    update public.characters
       set experience = experience + 15, state_version = state_version + 1, updated_at = now()
     where id = v_character.id;
  end if;

  update public.campaign_game_state set revision = revision + 1, updated_by = v_user_id, updated_at = now()
   where campaign_id = p_campaign_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (p_campaign_id, v_user_id, v_character.id, 'quest_accepted', jsonb_build_object('questId', 'amber-shard'));
  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.attack_campaign_slime(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
  v_player_roll integer;
  v_player_total integer;
  v_player_hit boolean;
  v_player_critical boolean;
  v_player_damage integer := 0;
  v_player_die_one integer := 0;
  v_player_die_two integer := 0;
  v_enemy_roll integer := null;
  v_enemy_total integer := null;
  v_enemy_hit boolean := false;
  v_enemy_critical boolean := false;
  v_enemy_damage integer := 0;
  v_enemy_die_one integer := 0;
  v_enemy_die_two integer := 0;
  v_new_slime_hp integer;
  v_new_character_hp integer;
  v_quester record;
begin
  if v_user_id is null then raise exception 'Entre na sua conta para atacar.' using errcode = '28000'; end if;
  if not public.is_campaign_member(p_campaign_id) then raise exception 'Você não é participante desta campanha.' using errcode = '42501'; end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id for update;
  if v_character.id is null then raise exception 'Crie um personagem antes de entrar em combate.' using errcode = 'P0001'; end if;
  if v_character.hp = 0 then raise exception 'Seu personagem precisa descansar antes de lutar.' using errcode = 'P0001'; end if;
  if v_character.quest_status <> 'active' then raise exception 'Aceite a missão de Lira antes de enfrentar o lodo.' using errcode = 'P0001'; end if;
  if abs(v_character.col - 9) + abs(v_character.row - 5) > 1 then raise exception 'Aproxime-se do lodo para atacar.' using errcode = 'P0001'; end if;
  if v_world.slime_hp = 0 then raise exception 'O lodo já foi derrotado nesta campanha.' using errcode = 'P0001'; end if;

  v_player_roll := floor(random() * 20)::integer + 1;
  v_player_total := v_player_roll + v_character.attack_bonus;
  v_player_critical := v_player_roll = 20;
  v_player_hit := v_player_critical or (v_player_roll <> 1 and v_player_total >= 13);
  v_new_slime_hp := v_world.slime_hp;
  if v_player_hit then
    v_player_die_one := floor(random() * 6)::integer + 1;
    v_player_damage := v_player_die_one + 2;
    if v_player_critical then
      v_player_die_two := floor(random() * 6)::integer + 1;
      v_player_damage := v_player_damage + v_player_die_two;
    end if;
    v_new_slime_hp := greatest(0, v_world.slime_hp - v_player_damage);
  end if;

  v_new_character_hp := v_character.hp;
  if v_new_slime_hp > 0 then
    v_enemy_roll := floor(random() * 20)::integer + 1;
    v_enemy_total := v_enemy_roll + 2;
    v_enemy_critical := v_enemy_roll = 20;
    v_enemy_hit := v_enemy_critical or (v_enemy_roll <> 1 and v_enemy_total >= v_character.defense);
    if v_enemy_hit then
      v_enemy_die_one := floor(random() * 4)::integer + 1;
      v_enemy_damage := v_enemy_die_one + 1;
      if v_enemy_critical then
        v_enemy_die_two := floor(random() * 4)::integer + 1;
        v_enemy_damage := v_enemy_damage + v_enemy_die_two;
      end if;
      v_new_character_hp := greatest(0, v_character.hp - v_enemy_damage);
    end if;
  end if;

  update public.characters
     set hp = v_new_character_hp,
         state_version = state_version + 1,
         updated_at = now()
   where id = v_character.id;
  update public.campaign_game_state
     set slime_hp = v_new_slime_hp,
         revision = revision + 1,
         updated_by = v_user_id,
         updated_at = now()
   where campaign_id = p_campaign_id;

  if v_new_slime_hp = 0 then
    for v_quester in
      select id from public.characters
       where campaign_id = p_campaign_id and quest_status = 'active'
       for update
    loop
      insert into public.character_inventory (character_id, item_id, quantity)
      values (v_quester.id, 'amber-shard', 1)
      on conflict (character_id, item_id) do update
        set quantity = least(99, public.character_inventory.quantity + 1), updated_at = now();
      update public.characters
         set experience = experience + 15,
             state_version = state_version + 1,
             updated_at = now()
       where id = v_quester.id;
    end loop;
  end if;

  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (
    p_campaign_id,
    v_user_id,
    v_character.id,
    'combat',
    jsonb_build_object(
      'playerRoll', v_player_roll,
      'playerTotal', v_player_total,
      'playerHit', v_player_hit,
      'playerCritical', v_player_critical,
      'playerDamageDice', case when not v_player_hit then '[]'::jsonb when v_player_critical then jsonb_build_array(v_player_die_one, v_player_die_two) else jsonb_build_array(v_player_die_one) end,
      'playerDamage', v_player_damage,
      'slimeHp', v_new_slime_hp,
      'enemyRoll', v_enemy_roll,
      'enemyTotal', v_enemy_total,
      'enemyHit', v_enemy_hit,
      'enemyCritical', v_enemy_critical,
      'enemyDamageDice', case when not v_enemy_hit then '[]'::jsonb when v_enemy_critical then jsonb_build_array(v_enemy_die_one, v_enemy_die_two) else jsonb_build_array(v_enemy_die_one) end,
      'enemyDamage', v_enemy_damage,
      'heroHp', v_new_character_hp,
      'victory', v_new_slime_hp = 0
    )
  );

  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.deliver_campaign_quest(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
  v_new_experience integer;
  v_new_level integer;
  v_base_hp integer;
  v_base_attack integer;
  v_base_defense integer;
  v_new_max_hp integer;
begin
  if v_user_id is null then raise exception 'Entre na sua conta para concluir a missão.' using errcode = '28000'; end if;
  if not public.is_campaign_member(p_campaign_id) then raise exception 'Você não é participante desta campanha.' using errcode = '42501'; end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id for update;
  if v_character.id is null then raise exception 'Crie um personagem antes de concluir a missão.' using errcode = 'P0001'; end if;
  if abs(v_character.col - 5) + abs(v_character.row - 3) > 1 then raise exception 'Aproxime-se de Lira para entregar o fragmento.' using errcode = 'P0001'; end if;
  if v_character.quest_status <> 'active' then raise exception 'Não há uma missão ativa para concluir.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.character_inventory where character_id = v_character.id and item_id = 'amber-shard' and quantity > 0) then
    raise exception 'Você ainda não tem o fragmento de âmbar.' using errcode = 'P0001';
  end if;

  update public.character_inventory
     set quantity = quantity - 1, updated_at = now()
   where character_id = v_character.id and item_id = 'amber-shard';
  delete from public.character_inventory where character_id = v_character.id and item_id = 'amber-shard' and quantity = 0;

  v_new_experience := v_character.experience + 25;
  v_new_level := least(20, 1 + (v_new_experience / 100));
  v_base_hp := case v_character.character_class when 'guardian' then 18 when 'ranger' then 14 else 12 end;
  v_base_attack := case v_character.character_class when 'guardian' then 3 when 'ranger' then 4 else 5 end;
  v_base_defense := case v_character.character_class when 'guardian' then 14 when 'ranger' then 13 else 12 end;
  v_new_max_hp := least(100, v_base_hp + ((v_new_level - 1) * 2));

  update public.characters
     set quest_status = 'completed',
         experience = v_new_experience,
         level = v_new_level,
         max_hp = v_new_max_hp,
         hp = least(v_new_max_hp, hp + greatest(0, v_new_max_hp - max_hp)),
         attack_bonus = v_base_attack + ((v_new_level - 1) / 5),
         defense = v_base_defense + ((v_new_level - 1) / 5),
         state_version = state_version + 1,
         updated_at = now()
   where id = v_character.id;
  update public.campaign_game_state set revision = revision + 1, updated_by = v_user_id, updated_at = now()
   where campaign_id = p_campaign_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (p_campaign_id, v_user_id, v_character.id, 'quest_completed', jsonb_build_object('questId', 'amber-shard', 'experienceAwarded', 25));
  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.rest_campaign_character(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
begin
  if v_user_id is null then raise exception 'Entre na sua conta para descansar.' using errcode = '28000'; end if;
  if not public.is_campaign_member(p_campaign_id) then raise exception 'Você não é participante desta campanha.' using errcode = '42501'; end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id for update;
  if v_character.id is null then raise exception 'Crie um personagem antes de descansar.' using errcode = 'P0001'; end if;
  if abs(v_character.col - 2) + abs(v_character.row - 8) > 1 then raise exception 'Aproxime-se do acampamento para descansar.' using errcode = 'P0001'; end if;

  update public.characters set hp = max_hp, state_version = state_version + 1, updated_at = now() where id = v_character.id;
  update public.campaign_game_state set revision = revision + 1, updated_by = v_user_id, updated_at = now()
   where campaign_id = p_campaign_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (p_campaign_id, v_user_id, v_character.id, 'rested', jsonb_build_object('hpRestored', v_character.max_hp - v_character.hp));
  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

create or replace function public.master_reset_campaign_region(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_world public.campaign_game_state%rowtype;
  v_character public.characters%rowtype;
begin
  if v_user_id is null then raise exception 'Entre na sua conta para reiniciar a região.' using errcode = '28000'; end if;
  if not public.is_campaign_master(p_campaign_id) then raise exception 'Somente o mestre pode reiniciar a região.' using errcode = '42501'; end if;
  insert into public.campaign_game_state (campaign_id) values (p_campaign_id) on conflict do nothing;
  select * into v_world from public.campaign_game_state where campaign_id = p_campaign_id for update;
  update public.campaign_game_state
     set slime_hp = 7, revision = revision + 1, updated_by = v_user_id, updated_at = now()
   where campaign_id = p_campaign_id;

  with ranked_characters as (
    select character_row.id,
           row_number() over (order by character_row.created_at, character_row.id) - 1 as slot
      from public.characters as character_row
     where character_row.campaign_id = p_campaign_id
  ),
  walkable_slots as (
    select candidate_col.col,
           candidate_row.row,
           row_number() over (
             order by abs(candidate_col.col - 2) + abs(candidate_row.row - 8), candidate_row.row, candidate_col.col
           ) - 1 as slot
      from generate_series(0, 12) as candidate_col(col)
      cross join generate_series(0, 10) as candidate_row(row)
     where substr(case candidate_row.row
         when 0 then 'ggggggggggggg'
         when 1 then 'gggggggggwwgg'
         when 2 then 'ggggggggwwrgg'
         when 3 then 'gggpppgggppgg'
         when 4 then 'ggggppggggggg'
         when 5 then 'gggppgggggggg'
         when 6 then 'ggppggggggggg'
         when 7 then 'ggppggggggggg'
         when 8 then 'ggppggggggggg'
         when 9 then 'ggppggggggggg'
         when 10 then 'ggggggggggggg'
         else ''
       end, candidate_col.col + 1, 1) not in ('w', 'r')
       and (candidate_col.col, candidate_row.row) not in (
         (1, 1), (4, 1), (0, 4), (7, 1), (11, 4), (6, 8), (10, 7), (5, 3), (10, 2), (9, 5)
       )
  ),
  assigned_slots as (
    select ranked_characters.id, walkable_slots.col, walkable_slots.row
      from ranked_characters
      join walkable_slots using (slot)
  )
  update public.characters as character_row
     set col = assigned_slots.col,
         row = assigned_slots.row,
         hp = character_row.max_hp,
         quest_status = 'unstarted',
         state_version = character_row.state_version + 1,
         updated_at = now()
    from assigned_slots
   where character_row.id = assigned_slots.id;
  delete from public.character_inventory
   where character_id in (select id from public.characters where campaign_id = p_campaign_id)
     and item_id = 'amber-shard';

  select * into v_character from public.characters where campaign_id = p_campaign_id and user_id = v_user_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (p_campaign_id, v_user_id, v_character.id, 'region_reset', jsonb_build_object('regionId', 'clareira-da-vigilia'));
  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

revoke all on function public.first_region_is_walkable(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.get_campaign_game_snapshot(uuid) from public, anon;
revoke all on function public.create_campaign_character(uuid, text, text) from public, anon;
revoke all on function public.move_campaign_character(uuid, text) from public, anon;
revoke all on function public.accept_campaign_quest(uuid) from public, anon;
revoke all on function public.attack_campaign_slime(uuid) from public, anon;
revoke all on function public.deliver_campaign_quest(uuid) from public, anon;
revoke all on function public.rest_campaign_character(uuid) from public, anon;
revoke all on function public.master_reset_campaign_region(uuid) from public, anon;

grant execute on function public.get_campaign_game_snapshot(uuid) to authenticated;
grant execute on function public.create_campaign_character(uuid, text, text) to authenticated;
grant execute on function public.move_campaign_character(uuid, text) to authenticated;
grant execute on function public.accept_campaign_quest(uuid) to authenticated;
grant execute on function public.attack_campaign_slime(uuid) to authenticated;
grant execute on function public.deliver_campaign_quest(uuid) to authenticated;
grant execute on function public.rest_campaign_character(uuid) to authenticated;
grant execute on function public.master_reset_campaign_region(uuid) to authenticated;

-- Supabase Realtime publishes only rows the querying member is allowed to read via RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_game_state') then
      alter publication supabase_realtime add table public.campaign_game_state;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'characters') then
      alter publication supabase_realtime add table public.characters;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'character_inventory') then
      alter publication supabase_realtime add table public.character_inventory;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_game_events') then
      alter publication supabase_realtime add table public.campaign_game_events;
    end if;
  end if;
end;
$$;
