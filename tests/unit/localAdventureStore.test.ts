import { describe, expect, it } from 'vitest';
import { createStartingAdventure, loadLocalAdventure, saveLocalAdventure } from '../../src/services/game/localAdventureStore';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('local exploration save', () => {
  it('restores exploration, quest and inventory from the same browser storage', () => {
    const storage = new MemoryStorage();
    const state = loadLocalAdventure('campaign-1', storage);
    state.col = 5;
    state.row = 3;
    state.questStatus = 'active';
    state.inventory = [{ itemId: 'amber-shard', quantity: 1 }];
    state.updatedAt = '2026-11-04T00:00:00.000Z';
    saveLocalAdventure(state, storage);

    expect(loadLocalAdventure('campaign-1', storage)).toEqual(state);
    expect(loadLocalAdventure('campaign-2', storage).inventory).toEqual([]);
  });

  it('refuses to persist invalid map coordinates', () => {
    const storage = new MemoryStorage();
    const state = loadLocalAdventure('campaign-1', storage);
    state.col = 100;
    expect(() => saveLocalAdventure(state, storage)).toThrow(/Coluna de exploração inválida/);
  });

  it('preserves a malformed existing save rather than loading or replacing it', () => {
    const storage = new MemoryStorage();
    const key = 'veyrath.local.adventure.v1:campaign-1';
    const corrupted = JSON.stringify({ ...createStartingAdventure('campaign-1'), inventory: [null] });
    storage.setItem(key, corrupted);

    expect(() => loadLocalAdventure('campaign-1', storage)).toThrow(/formato.*inválido/i);
    expect(storage.getItem(key)).toBe(corrupted);
  });
});
