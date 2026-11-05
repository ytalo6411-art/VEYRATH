-- Keep inventory rows within their positive-quantity constraint when delivering a shard.
-- Defeated characters can return to a free camp tile and recover; living characters still
-- need to be next to camp before they can rest.

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

  delete from public.character_inventory
   where character_id = v_character.id and item_id = 'amber-shard' and quantity = 1;
  if not found then
    update public.character_inventory
       set quantity = quantity - 1, updated_at = now()
     where character_id = v_character.id and item_id = 'amber-shard' and quantity > 1;
  end if;

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
  v_spawn_col integer;
  v_spawn_row integer;
  v_was_defeated boolean;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para descansar.' using errcode = '28000';
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
   for update;
  select * into v_character
    from public.characters
   where campaign_id = p_campaign_id
     and user_id = v_user_id
   for update;
  if v_character.id is null then
    raise exception 'Crie um personagem antes de descansar.' using errcode = 'P0001';
  end if;

  v_was_defeated := v_character.hp = 0;
  if v_was_defeated then
    select candidate_col.col, candidate_row.row
      into v_spawn_col, v_spawn_row
      from generate_series(0, 12) as candidate_col(col)
      cross join generate_series(0, 10) as candidate_row(row)
     where public.first_region_is_walkable(
       p_campaign_id,
       candidate_col.col,
       candidate_row.row,
       v_character.id
     )
     order by abs(candidate_col.col - 2) + abs(candidate_row.row - 8), candidate_row.row, candidate_col.col
     limit 1;
    if v_spawn_col is null then
      raise exception 'Não há espaço seguro no acampamento. Peça ao mestre para reiniciar a região.' using errcode = 'P0001';
    end if;
  else
    if abs(v_character.col - 2) + abs(v_character.row - 8) > 1 then
      raise exception 'Aproxime-se do acampamento para descansar.' using errcode = 'P0001';
    end if;
    v_spawn_col := v_character.col;
    v_spawn_row := v_character.row;
  end if;

  update public.characters
     set col = v_spawn_col,
         row = v_spawn_row,
         hp = max_hp,
         state_version = state_version + 1,
         updated_at = now()
   where id = v_character.id;
  update public.campaign_game_state
     set revision = revision + 1,
         updated_by = v_user_id,
         updated_at = now()
   where campaign_id = p_campaign_id;
  insert into public.campaign_game_events (campaign_id, actor_id, character_id, event_type, payload)
  values (
    p_campaign_id,
    v_user_id,
    v_character.id,
    'rested',
    jsonb_build_object(
      'hpRestored', v_character.max_hp - v_character.hp,
      'returnedToCamp', v_was_defeated
    )
  );

  return public.get_campaign_game_snapshot(p_campaign_id);
end;
$$;

revoke all on function public.deliver_campaign_quest(uuid) from public, anon;
grant execute on function public.deliver_campaign_quest(uuid) to authenticated;
revoke all on function public.rest_campaign_character(uuid) from public, anon;
grant execute on function public.rest_campaign_character(uuid) to authenticated;
