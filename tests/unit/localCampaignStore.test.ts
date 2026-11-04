import { describe, expect, it } from 'vitest';
import { createLocalCampaign, listLocalCampaigns } from '../../src/services/campaigns/localCampaignStore';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('Local Workshop campaign storage', () => {
  it('creates a clearly local record and recovers it from the same storage', () => {
    const storage = new MemoryStorage();
    const campaign = createLocalCampaign(
      { name: 'As lanternas de Varda', description: 'Uma campanha de teste.' },
      storage,
      () => new Date('2026-11-04T12:00:00.000Z'),
      () => 'local-campaign-1',
    );

    expect(campaign).toMatchObject({
      id: 'local-campaign-1',
      name: 'As lanternas de Varda',
      mode: 'local',
      role: 'master',
      inviteCode: null,
    });
    expect(listLocalCampaigns(storage)).toEqual([campaign]);
  });

  it('does not silently replace malformed browser data', () => {
    const storage = new MemoryStorage();
    storage.setItem('veyrath.local.campaigns.v1', '{bad json');

    expect(() => listLocalCampaigns(storage)).toThrow(/corrompidos/);
    expect(storage.getItem('veyrath.local.campaigns.v1')).toBe('{bad json');
  });

  it('keeps newer campaigns first', () => {
    const storage = new MemoryStorage();
    createLocalCampaign({ name: 'Campanha antiga', description: '' }, storage, () => new Date('2026-01-01T00:00:00.000Z'), () => 'old');
    createLocalCampaign({ name: 'Campanha recente', description: '' }, storage, () => new Date('2026-11-04T00:00:00.000Z'), () => 'new');

    expect(listLocalCampaigns(storage).map((campaign) => campaign.name)).toEqual([
      'Campanha recente',
      'Campanha antiga',
    ]);
  });
});
