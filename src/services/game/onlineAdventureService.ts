import { supabase } from '../supabase/client';
import type { Database, Json } from '../../types/database';

export type CharacterClass = 'guardian' | 'ranger' | 'arcanist';
export type OnlineQuestStatus = 'unstarted' | 'active' | 'completed';
export type MoveDirection = 'up' | 'right' | 'down' | 'left';
export type OnlineGameEventType =
  | 'character_created'
  | 'moved'
  | 'quest_accepted'
  | 'combat'
  | 'quest_completed'
  | 'rested'
  | 'region_reset';

export interface OnlineCharacter {
  id: string;
  userId: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  attackBonus: number;
  defense: number;
  col: number;
  row: number;
  questStatus: OnlineQuestStatus;
  stateVersion: number;
}

export interface OnlineInventoryStack {
  itemId: 'amber-shard';
  quantity: number;
}

export interface OnlinePlayer {
  id: string;
  userId: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  col: number;
  row: number;
  questStatus: OnlineQuestStatus;
  stateVersion: number;
}

export interface OnlineGameEvent {
  id: number;
  eventType: OnlineGameEventType;
  actorName: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OnlineAdventureSnapshot {
  campaignId: string;
  regionId: 'clareira-da-vigilia';
  world: {
    slimeHp: number;
    slimeDefeated: boolean;
    revision: number;
    updatedAt: string;
  };
  character: OnlineCharacter | null;
  inventory: OnlineInventoryStack[];
  players: OnlinePlayer[];
  recentEvents: OnlineGameEvent[];
}

type RpcName = keyof Database['public']['Functions'];
type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcMethod = (name: string, args: Record<string, unknown>) => Promise<RpcResponse>;

function requireClient() {
  if (!supabase) throw new Error('O modo online não está configurado neste ambiente.');
  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isCharacterClass(value: unknown): value is CharacterClass {
  return value === 'guardian' || value === 'ranger' || value === 'arcanist';
}

function isQuestStatus(value: unknown): value is OnlineQuestStatus {
  return value === 'unstarted' || value === 'active' || value === 'completed';
}

function isEventType(value: unknown): value is OnlineGameEventType {
  return value === 'character_created'
    || value === 'moved'
    || value === 'quest_accepted'
    || value === 'combat'
    || value === 'quest_completed'
    || value === 'rested'
    || value === 'region_reset';
}

function parseCharacter(value: unknown): OnlineCharacter | null {
  if (value === null) return null;
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.userId !== 'string'
    || typeof value.name !== 'string'
    || !isCharacterClass(value.characterClass)
    || !isInteger(value.level)
    || !isInteger(value.experience)
    || !isInteger(value.hp)
    || !isInteger(value.maxHp)
    || !isInteger(value.attackBonus)
    || !isInteger(value.defense)
    || !isInteger(value.col)
    || !isInteger(value.row)
    || !isQuestStatus(value.questStatus)
    || !isInteger(value.stateVersion)) return null;

  return {
    id: value.id,
    userId: value.userId,
    name: value.name,
    characterClass: value.characterClass,
    level: value.level,
    experience: value.experience,
    hp: value.hp,
    maxHp: value.maxHp,
    attackBonus: value.attackBonus,
    defense: value.defense,
    col: value.col,
    row: value.row,
    questStatus: value.questStatus,
    stateVersion: value.stateVersion,
  };
}

function parsePlayer(value: unknown): OnlinePlayer | null {
  const character = parseCharacter(value);
  if (!character) return null;
  return {
    id: character.id,
    userId: character.userId,
    name: character.name,
    characterClass: character.characterClass,
    level: character.level,
    experience: character.experience,
    hp: character.hp,
    maxHp: character.maxHp,
    col: character.col,
    row: character.row,
    questStatus: character.questStatus,
    stateVersion: character.stateVersion,
  };
}

function parseSnapshot(value: unknown, expectedCampaignId: string): OnlineAdventureSnapshot {
  if (!isRecord(value)
    || value.campaignId !== expectedCampaignId
    || value.regionId !== 'clareira-da-vigilia'
    || !isRecord(value.world)
    || !isInteger(value.world.slimeHp)
    || value.world.slimeHp < 0
    || value.world.slimeHp > 7
    || typeof value.world.slimeDefeated !== 'boolean'
    || !isInteger(value.world.revision)
    || typeof value.world.updatedAt !== 'string'
    || !Array.isArray(value.inventory)
    || !Array.isArray(value.players)
    || !Array.isArray(value.recentEvents)) {
    throw new Error('O servidor retornou um estado de aventura inválido. Atualize a mesa e tente novamente.');
  }

  const character = parseCharacter(value.character);
  if (value.character !== null && !character) {
    throw new Error('Os dados do personagem recebidos do servidor são inválidos.');
  }

  const inventory = value.inventory.map((entry) => {
    if (!isRecord(entry) || entry.itemId !== 'amber-shard' || !isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) {
      throw new Error('O inventário recebido do servidor é inválido.');
    }
    return { itemId: 'amber-shard' as const, quantity: entry.quantity };
  });

  const players = value.players.map(parsePlayer);
  if (players.some((player) => !player)) throw new Error('A lista de personagens da campanha é inválida.');

  const recentEvents = value.recentEvents.map((entry) => {
    if (!isRecord(entry)
      || !isInteger(entry.id)
      || !isEventType(entry.eventType)
      || typeof entry.actorName !== 'string'
      || !isRecord(entry.payload)
      || typeof entry.createdAt !== 'string') {
      throw new Error('O registro de atividades da campanha é inválido.');
    }
    return {
      id: entry.id,
      eventType: entry.eventType,
      actorName: entry.actorName,
      payload: entry.payload,
      createdAt: entry.createdAt,
    };
  });

  return {
    campaignId: value.campaignId,
    regionId: value.regionId,
    world: {
      slimeHp: value.world.slimeHp,
      slimeDefeated: value.world.slimeDefeated,
      revision: value.world.revision,
      updatedAt: value.world.updatedAt,
    },
    character,
    inventory,
    players: players as OnlinePlayer[],
    recentEvents,
  };
}

async function rpcSnapshot(name: RpcName, args: Record<string, unknown>, campaignId: string): Promise<OnlineAdventureSnapshot> {
  const client = requireClient();
  const rpc = client.rpc.bind(client) as unknown as RpcMethod;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return parseSnapshot(data as Json, campaignId);
}

export const onlineAdventureService = {
  getSnapshot(campaignId: string) {
    return rpcSnapshot('get_campaign_game_snapshot', { p_campaign_id: campaignId }, campaignId);
  },

  createCharacter(campaignId: string, name: string, characterClass: CharacterClass) {
    return rpcSnapshot('create_campaign_character', {
      p_campaign_id: campaignId,
      p_name: name,
      p_character_class: characterClass,
    }, campaignId);
  },

  move(campaignId: string, direction: MoveDirection) {
    return rpcSnapshot('move_campaign_character', { p_campaign_id: campaignId, p_direction: direction }, campaignId);
  },

  acceptQuest(campaignId: string) {
    return rpcSnapshot('accept_campaign_quest', { p_campaign_id: campaignId }, campaignId);
  },

  attackSlime(campaignId: string) {
    return rpcSnapshot('attack_campaign_slime', { p_campaign_id: campaignId }, campaignId);
  },

  deliverQuest(campaignId: string) {
    return rpcSnapshot('deliver_campaign_quest', { p_campaign_id: campaignId }, campaignId);
  },

  rest(campaignId: string) {
    return rpcSnapshot('rest_campaign_character', { p_campaign_id: campaignId }, campaignId);
  },

  resetRegion(campaignId: string) {
    return rpcSnapshot('master_reset_campaign_region', { p_campaign_id: campaignId }, campaignId);
  },

  watchCampaign(campaignId: string, onChange: () => void, onConnectionChange?: (connected: boolean) => void) {
    const client = requireClient();
    const channel = client
      .channel(`campaign-game:${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_game_state',
        filter: `campaign_id=eq.${campaignId}`,
      }, onChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'characters',
        filter: `campaign_id=eq.${campaignId}`,
      }, onChange)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'campaign_game_events',
        filter: `campaign_id=eq.${campaignId}`,
      }, onChange)
      .subscribe((status) => onConnectionChange?.(status === 'SUBSCRIBED'));

    return () => {
      void client.removeChannel(channel);
    };
  },
};
