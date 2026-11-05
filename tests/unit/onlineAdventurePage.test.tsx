import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeRuntime, onlineService, setFakeNearbyTarget } = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;
  let fakeNearbyTarget: 'lira' | 'marsh-slime' = 'lira';
  class FakeEvents {
    private listeners = new Map<string, Set<Listener>>();
    on(event: string, listener: Listener): this {
      const current = this.listeners.get(event) ?? new Set<Listener>();
      current.add(listener);
      this.listeners.set(event, current);
      return this;
    }
    off(event: string, listener: Listener): this {
      this.listeners.get(event)?.delete(listener);
      return this;
    }
    emit(event: string, ...args: unknown[]): this {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
      return this;
    }
  }
  class Runtime {
    game = { events: new FakeEvents() };
    constructor() {
      this.game.events.on('world:interact-request', () => this.game.events.emit('world:interaction', { target: fakeNearbyTarget }));
      queueMicrotask(() => this.game.events.emit('world:nearby', fakeNearbyTarget));
    }
    destroy(): void {}
  }
  return {
    FakeRuntime: Runtime,
    setFakeNearbyTarget: (target: 'lira' | 'marsh-slime') => { fakeNearbyTarget = target; },
    onlineService: {
      getSnapshot: vi.fn(),
      createCharacter: vi.fn(),
      move: vi.fn(),
      acceptQuest: vi.fn(),
      attackSlime: vi.fn(),
      deliverQuest: vi.fn(),
      rest: vi.fn(),
      resetRegion: vi.fn(),
      watchCampaign: vi.fn(),
    },
  };
});

vi.mock('../../src/game/core/GameRuntime', () => ({ GameRuntime: FakeRuntime }));
vi.mock('../../src/game/scenes/FirstRegionScene', () => ({ FirstRegionScene: class {} }));
vi.mock('../../src/services/game/onlineAdventureService', () => ({ onlineAdventureService: onlineService }));

import { OnlineAdventurePage } from '../../src/app/pages/OnlineAdventurePage';
import type { OnlineAdventureSnapshot } from '../../src/services/game/onlineAdventureService';
import type { CampaignSummary } from '../../src/types/campaign';

const campaign: CampaignSummary = {
  id: 'online-campaign-test',
  name: 'Mesa Online de Teste',
  description: 'Uma mesa cloud para testar o jogo compartilhado.',
  inviteCode: 'ABC12345',
  createdAt: '2026-11-05T00:00:00.000Z',
  role: 'master',
  mode: 'cloud',
};

const character = {
  id: 'online-character-test',
  userId: 'online-user-test',
  name: 'Maelis',
  characterClass: 'guardian' as const,
  level: 1,
  experience: 0,
  hp: 18,
  maxHp: 18,
  attackBonus: 3,
  defense: 14,
  col: 2,
  row: 8,
  questStatus: 'unstarted' as const,
  stateVersion: 0,
};

function makeSnapshot(overrides: Partial<OnlineAdventureSnapshot> = {}): OnlineAdventureSnapshot {
  return {
    campaignId: campaign.id,
    regionId: 'clareira-da-vigilia',
    world: { slimeHp: 7, slimeDefeated: false, revision: 0, updatedAt: '2026-11-05T00:00:00.000Z' },
    character,
    inventory: [],
    players: [character],
    recentEvents: [],
    ...overrides,
  };
}

beforeEach(() => {
  setFakeNearbyTarget('lira');
  onlineService.getSnapshot.mockReset();
  onlineService.createCharacter.mockReset();
  onlineService.acceptQuest.mockReset();
  onlineService.rest.mockReset();
  onlineService.watchCampaign.mockReset();
  onlineService.watchCampaign.mockImplementation(() => () => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('online adventure UI', () => {
  it('creates an account-owned character and accepts the quest through server RPCs', async () => {
    onlineService.getSnapshot.mockResolvedValueOnce(makeSnapshot({ character: null, players: [] }));
    onlineService.createCharacter.mockResolvedValueOnce(makeSnapshot());
    onlineService.acceptQuest.mockResolvedValueOnce(makeSnapshot({
      character: { ...character, questStatus: 'active', stateVersion: 1 },
      players: [{ ...character, questStatus: 'active', stateVersion: 1 }],
    }));

    render(<OnlineAdventurePage campaign={campaign} onBack={() => undefined} />);

    fireEvent.change(await screen.findByLabelText('Nome do personagem'), { target: { value: 'Maelis' } });
    fireEvent.click(screen.getByRole('radio', { name: /Batedor/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar personagem e entrar' }));

    expect(await screen.findByRole('heading', { name: 'Maelis' })).toBeTruthy();
    expect(onlineService.createCharacter).toHaveBeenCalledWith(campaign.id, 'Maelis', 'ranger');

    fireEvent.click(await screen.findByRole('button', { name: /Conversar com Lira/ }));
    expect(await screen.findByRole('heading', { name: 'Lira, batedora da margem' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar missão' }));

    await waitFor(() => expect(onlineService.acceptQuest).toHaveBeenCalledWith(campaign.id));
    expect(await screen.findByText('Em andamento')).toBeTruthy();
    expect(screen.getByText('Missão aceita por toda a mesa.')).toBeTruthy();
  });

  it('offers a server-side return to camp for a defeated character', async () => {
    setFakeNearbyTarget('marsh-slime');
    const downed = { ...character, hp: 0, col: 8, row: 5, questStatus: 'active' as const, stateVersion: 1 };
    const recovered = { ...downed, hp: downed.maxHp, col: 2, row: 8, stateVersion: 2 };
    onlineService.getSnapshot.mockResolvedValueOnce(makeSnapshot({ character: downed, players: [downed] }));
    onlineService.rest.mockResolvedValueOnce(makeSnapshot({ character: recovered, players: [recovered] }));

    render(<OnlineAdventurePage campaign={campaign} onBack={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /Enfrentar o lodo/ }));
    expect(await screen.findByRole('heading', { name: 'Retornar ao acampamento' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Retornar ao acampamento e recuperar vida/ }));

    await waitFor(() => expect(onlineService.rest).toHaveBeenCalledWith(campaign.id));
    expect(await screen.findByText('Vida restaurada no servidor.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
