import type { CampaignDraft, CampaignSummary } from '../../types/campaign';
import { validateCampaignDraft } from './campaignDomain';

const STORAGE_KEY = 'veyrath.local.campaigns.v1';
const LOCAL_WORKSPACE_ID = 'local-workshop';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface LocalCampaignRecord extends CampaignSummary {
  mode: 'local';
  inviteCode: null;
  role: 'master';
}

function defaultStorage(): StoragePort {
  if (typeof window === 'undefined') {
    throw new Error('O armazenamento local só está disponível no navegador.');
  }
  return window.localStorage;
}

function parseRecords(serialized: string | null): LocalCampaignRecord[] {
  if (!serialized) return [];

  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('Os dados locais de campanha estão corrompidos e não foram sobrescritos.');
  }

  if (!Array.isArray(value)) {
    throw new Error('O formato dos dados locais de campanha é inválido.');
  }

  return value.map((record: unknown) => {
    if (
      typeof record !== 'object' ||
      record === null ||
      !('id' in record) || typeof record.id !== 'string' ||
      !('name' in record) || typeof record.name !== 'string' ||
      !('description' in record) || typeof record.description !== 'string' ||
      !('createdAt' in record) || typeof record.createdAt !== 'string'
    ) {
      throw new Error('Uma campanha local tem dados inválidos; nenhuma alteração foi salva.');
    }
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      inviteCode: null,
      role: 'master',
      mode: 'local',
    };
  });
}

function persist(records: LocalCampaignRecord[], storage: StoragePort): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new Error('Não foi possível salvar neste navegador. Verifique o espaço e as permissões de armazenamento.');
  }
}

export function listLocalCampaigns(storage: StoragePort = defaultStorage()): CampaignSummary[] {
  return parseRecords(storage.getItem(STORAGE_KEY)).sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

export function createLocalCampaign(
  draft: CampaignDraft,
  storage: StoragePort = defaultStorage(),
  now: () => Date = () => new Date(),
  createId: () => string = () => crypto.randomUUID(),
): CampaignSummary {
  const validDraft = validateCampaignDraft(draft);
  const records = parseRecords(storage.getItem(STORAGE_KEY));
  const campaign: LocalCampaignRecord = {
    id: createId(),
    ...validDraft,
    inviteCode: null,
    createdAt: now().toISOString(),
    role: 'master',
    mode: 'local',
  };

  persist([campaign, ...records], storage);
  return campaign;
}

export const localWorkspace = {
  id: LOCAL_WORKSPACE_ID,
  label: 'Oficina local',
} as const;
