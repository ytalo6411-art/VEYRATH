import { describe, expect, it } from 'vitest';
import { resolveAttack, rollDie } from '../../src/engine/rules/d20';

describe('D20 combat primitives', () => {
  it('rolls within die bounds', () => {
    expect(rollDie(20, () => 0)).toBe(1);
    expect(rollDie(20, () => 0.999999)).toBe(20);
  });

  it('treats a natural one as a critical miss', () => {
    const result = resolveAttack({ attackBonus: 20, defense: 5, damageDie: 6, damageBonus: 2 }, () => 0);
    expect(result).toMatchObject({ natural: 1, hit: false, damage: 0, critical: false });
  });

  it('doubles the damage die on a natural twenty', () => {
    const rolls = [0.999, 0, 0.5];
    const result = resolveAttack({ attackBonus: 2, defense: 30, damageDie: 6, damageBonus: 1 }, () => rolls.shift() ?? 0);
    expect(result).toMatchObject({ natural: 20, hit: true, critical: true, damageRolls: [1, 4], damage: 6 });
  });
});
