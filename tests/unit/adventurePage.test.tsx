import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeRuntime } = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeEvents {
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(event, listeners);
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
    private position = { col: 2, row: 8 };
    private slimeDefeated = false;

    constructor() {
      const events = this.game.events;
      events.on('world:request-state', () => this.emitState());
      events.on('world:step', (direction) => {
        if (direction === 'up') this.position = { col: this.position.col, row: this.position.row - 1 };
        if (direction === 'right') this.position = { col: this.position.col + 1, row: this.position.row };
        if (direction === 'down') this.position = { col: this.position.col, row: this.position.row + 1 };
        if (direction === 'left') this.position = { col: this.position.col - 1, row: this.position.row };
        this.emitState();
      });
      events.on('world:interact-request', () => {
        const target = this.findNearby();
        if (target) events.emit('world:interaction', { target });
      });
      events.on('world:teleport', (position) => {
        this.position = position as { col: number; row: number };
        this.emitState();
      });
      events.on('world:slime-defeated', () => {
        this.slimeDefeated = true;
        this.emitState();
      });
      queueMicrotask(() => this.emitState());
    }

    private findNearby(): 'camp' | 'lira' | 'marsh-slime' | null {
      const targets = [
        { id: 'camp' as const, col: 2, row: 8 },
        { id: 'lira' as const, col: 5, row: 3 },
        ...(!this.slimeDefeated ? [{ id: 'marsh-slime' as const, col: 9, row: 5 }] : []),
      ];
      return targets
        .filter((target) => Math.abs(target.col - this.position.col) + Math.abs(target.row - this.position.row) <= 1)
        .sort((left, right) => (
          Math.abs(left.col - this.position.col) + Math.abs(left.row - this.position.row)
          - Math.abs(right.col - this.position.col) - Math.abs(right.row - this.position.row)
        ))[0]?.id ?? null;
    }

    private emitState(): void {
      this.game.events.emit('world:position', this.position);
      this.game.events.emit('world:nearby', this.findNearby());
    }

    destroy(): void {}
  }

  return { FakeRuntime: Runtime };
});

vi.mock('../../src/game/core/GameRuntime', () => ({ GameRuntime: FakeRuntime }));
vi.mock('../../src/game/scenes/FirstRegionScene', () => ({ FirstRegionScene: class {} }));

import { AdventurePage } from '../../src/app/pages/AdventurePage';
import type { CampaignSummary } from '../../src/types/campaign';

const campaign: CampaignSummary = {
  id: 'campaign-adventure-test',
  name: 'Clareira de Teste',
  description: 'Uma crônica para validar a prévia.',
  inviteCode: null,
  createdAt: '2026-11-04T00:00:00.000Z',
  role: 'master',
  mode: 'cloud',
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('first-region preview UI', () => {
  it('moves the character and stores the region position under its campaign', async () => {
    render(<AdventurePage campaign={campaign} onBack={() => undefined} />);

    await screen.findByRole('button', { name: /Examinar o acampamento/ });
    fireEvent.click(screen.getByRole('button', { name: 'Mover para cima' }));

    const saveKey = 'veyrath.local.adventure.v1:campaign-adventure-test';
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(saveKey) ?? 'null') as { row?: number } | null;
      expect(saved?.row).toBe(7);
    });
    expect(screen.getByText('3 · 8')).toBeTruthy();
  });

  it('opens the camp interaction and restores health through the UI action', async () => {
    render(<AdventurePage campaign={campaign} onBack={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /Examinar o acampamento/ }));
    expect(await screen.findByRole('heading', { name: 'Acampamento da Vigília' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descansar e recuperar vida' }));

    expect(await screen.findByText('Você descansou no acampamento. Seus pontos de vida foram restaurados.')).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem('veyrath.local.adventure.v1:campaign-adventure-test') ?? 'null') as { hp?: number } | null;
    expect(saved?.hp).toBe(12);
  });

  it('completes Lira’s quest through the local D20 encounter and saves its reward', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    render(<AdventurePage campaign={campaign} onBack={() => undefined} />);
    await screen.findByRole('button', { name: /Examinar o acampamento/ });

    for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Mover para cima' }));
    for (let step = 0; step < 3; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    fireEvent.click(await screen.findByRole('button', { name: /Conversar com Lira/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar missão' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vou procurar' }));

    for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    fireEvent.click(await screen.findByRole('button', { name: /Enfrentar o lodo/ }));
    expect(await screen.findByRole('heading', { name: 'Lodo do Brejo de Varda' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rolar ataque D20' }));

    const saveKey = 'veyrath.local.adventure.v1:campaign-adventure-test';
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(saveKey) ?? 'null') as {
        slimeHp?: number;
        experience?: number;
        inventory?: Array<{ itemId: string; quantity: number }>;
      } | null;
      expect(saved).toMatchObject({ slimeHp: 0, experience: 15, inventory: [{ itemId: 'amber-shard', quantity: 1 }] });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Voltar à clareira' }));
    for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Mover para a esquerda' }));
    fireEvent.click(await screen.findByRole('button', { name: /Conversar com Lira/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar e concluir missão' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(saveKey) ?? 'null') as {
        questStatus?: string;
        experience?: number;
        inventory?: unknown[];
      } | null;
      expect(saved).toMatchObject({ questStatus: 'completed', experience: 40, inventory: [] });
    });
  });
});
