import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../src/services/supabase/client', () => ({ supabase: { rpc } }));

import { onlineAdventureService } from '../../src/services/game/onlineAdventureService';

const campaignId = 'campaign-online-test';
const character = {
  id: 'character-1',
  userId: 'user-1',
  name: 'Maelis',
  characterClass: 'guardian',
  level: 1,
  experience: 0,
  hp: 18,
  maxHp: 18,
  attackBonus: 3,
  defense: 14,
  col: 2,
  row: 8,
  questStatus: 'unstarted',
  stateVersion: 0,
};
const snapshot = {
  campaignId,
  regionId: 'clareira-da-vigilia',
  world: { slimeHp: 7, slimeDefeated: false, revision: 0, updatedAt: '2026-11-05T00:00:00.000Z' },
  character,
  inventory: [],
  players: [character],
  recentEvents: [],
};

beforeEach(() => rpc.mockReset());

describe('online adventure service', () => {
  it('calls the authoritative movement RPC and validates its campaign snapshot', async () => {
    rpc.mockResolvedValue({ data: snapshot, error: null });

    const result = await onlineAdventureService.move(campaignId, 'right');

    expect(rpc).toHaveBeenCalledWith('move_campaign_character', {
      p_campaign_id: campaignId,
      p_direction: 'right',
    });
    expect(result.character).toMatchObject({ id: 'character-1', col: 2, row: 8 });
    expect(result.players).toHaveLength(1);
  });

  it('rejects a malformed or cross-campaign snapshot instead of accepting client state', async () => {
    rpc.mockResolvedValue({ data: { ...snapshot, campaignId: 'another-campaign' }, error: null });

    await expect(onlineAdventureService.getSnapshot(campaignId)).rejects.toThrow('estado de aventura inválido');
  });

  it('surfaces server validation errors without treating them as successful actions', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Esse caminho está bloqueado.' } });

    await expect(onlineAdventureService.move(campaignId, 'up')).rejects.toThrow('Esse caminho está bloqueado.');
  });
});
