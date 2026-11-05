import { FIRST_REGION } from '../../game/world/firstRegionData';
import type { StoragePort } from '../campaigns/localCampaignStore';

export type QuestStatus = 'unstarted' | 'active' | 'completed';

export interface InventoryStack {
  itemId: 'amber-shard';
  quantity: number;
}

export interface LocalAdventureState {
  schemaVersion: 1;
  campaignId: string;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  slimeHp: number;
  questStatus: QuestStatus;
  inventory: InventoryStack[];
  experience: number;
  updatedAt: string;
}

function defaultStorage(): StoragePort {
  if (typeof window === 'undefined') throw new Error('O progresso local só está disponível no navegador.');
  return window.localStorage;
}

function storageKey(campaignId: string): string {
  return `veyrath.local.adventure.v1:${encodeURIComponent(campaignId)}`;
}

export function createStartingAdventure(campaignId: string, now = new Date()): LocalAdventureState {
  return {
    schemaVersion: 1,
    campaignId,
    col: FIRST_REGION.start.col,
    row: FIRST_REGION.start.row,
    hp: 12,
    maxHp: 12,
    slimeHp: 7,
    questStatus: 'unstarted',
    inventory: [],
    experience: 0,
    updatedAt: now.toISOString(),
  };
}

export function loadLocalAdventure(
  campaignId: string,
  storage: StoragePort = defaultStorage(),
): LocalAdventureState {
  const serialized = storage.getItem(storageKey(campaignId));
  if (!serialized) return createStartingAdventure(campaignId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('O progresso local desta aventura está corrompido; ele não foi sobrescrito.');
  }
  if (!isAdventureState(parsed) || parsed.campaignId !== campaignId) {
    throw new Error('O formato do progresso local é inválido; ele não foi sobrescrito.');
  }
  return parsed;
}

export function saveLocalAdventure(
  state: LocalAdventureState,
  storage: StoragePort = defaultStorage(),
): void {
  validateAdventure(state);
  try {
    storage.setItem(storageKey(state.campaignId), JSON.stringify(state));
  } catch {
    throw new Error('Não foi possível salvar o progresso neste navegador.');
  }
}

function isAdventureState(value: unknown): value is LocalAdventureState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return state.schemaVersion === 1
    && typeof state.campaignId === 'string'
    && state.campaignId.trim().length > 0
    && Number.isInteger(state.col)
    && Number.isInteger(state.row)
    && Number.isInteger(state.hp)
    && Number.isInteger(state.maxHp)
    && Number.isInteger(state.slimeHp)
    && (state.questStatus === 'unstarted' || state.questStatus === 'active' || state.questStatus === 'completed')
    && isInventory(state.inventory)
    && Number.isInteger(state.experience)
    && typeof state.updatedAt === 'string'
    && (state.col as number) >= 0
    && (state.col as number) < FIRST_REGION.columns
    && (state.row as number) >= 0
    && (state.row as number) < FIRST_REGION.rows
    && (state.maxHp as number) >= 1
    && (state.hp as number) >= 0
    && (state.hp as number) <= (state.maxHp as number)
    && (state.slimeHp as number) >= 0
    && (state.slimeHp as number) <= 7
    && (state.experience as number) >= 0;
}

function isInventory(value: unknown): value is InventoryStack[] {
  return Array.isArray(value) && value.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const stack = entry as Record<string, unknown>;
    return stack.itemId === 'amber-shard'
      && typeof stack.quantity === 'number'
      && Number.isInteger(stack.quantity)
      && stack.quantity >= 0;
  });
}

function validateAdventure(state: LocalAdventureState): void {
  if (state.schemaVersion !== 1) throw new Error('Versão de aventura local inválida.');
  if (!state.campaignId.trim()) throw new Error('A aventura precisa pertencer a uma campanha.');
  if (!Number.isInteger(state.col) || state.col < 0 || state.col >= FIRST_REGION.columns) throw new Error('Coluna de exploração inválida.');
  if (!Number.isInteger(state.row) || state.row < 0 || state.row >= FIRST_REGION.rows) throw new Error('Linha de exploração inválida.');
  if (!Number.isInteger(state.maxHp) || state.maxHp < 1 || !Number.isInteger(state.hp) || state.hp < 0 || state.hp > state.maxHp) throw new Error('Pontos de vida inválidos.');
  if (!Number.isInteger(state.slimeHp) || state.slimeHp < 0 || state.slimeHp > 7) throw new Error('Vida da criatura inválida.');
  if (state.experience < 0 || !Number.isInteger(state.experience)) throw new Error('Experiência inválida.');
  if (!isInventory(state.inventory)) throw new Error('Inventário local inválido.');
  if (state.questStatus !== 'unstarted' && state.questStatus !== 'active' && state.questStatus !== 'completed') {
    throw new Error('Estado da missão local inválido.');
  }
}
