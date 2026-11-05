import { describe, expect, it } from 'vitest';
import { beginFirstEncounter, resolveFirstEncounterTurn } from '../../src/engine/combat/firstEncounter';

describe('first D20 encounter', () => {
  it('uses initiative and gives ties to the player', () => {
    const rolls = [0.5, 0.5];
    const encounter = beginFirstEncounter(12, 12, 7, () => rolls.shift() ?? 0);

    expect(encounter).toMatchObject({ heroInitiative: 13, slimeInitiative: 12, turn: 'hero', phase: 'active' });
  });

  it('ends in victory when a critical player strike defeats the slime', () => {
    const initiative = [0, 0];
    const encounter = beginFirstEncounter(12, 12, 7, () => initiative.shift() ?? 0);
    const attackRolls = [0.999, 0.999, 0.999];
    const result = resolveFirstEncounterTurn(encounter, () => attackRolls.shift() ?? 0);

    expect(result.actor).toBe('hero');
    expect(result.attack).toMatchObject({ natural: 20, hit: true, critical: true, damage: 14 });
    expect(result.state).toMatchObject({ phase: 'victory', slimeHp: 0, heroHp: 12 });
  });

  it('lets the slime act first when its initiative is higher', () => {
    const initiative = [0, 0.999];
    const encounter = beginFirstEncounter(12, 12, 7, () => initiative.shift() ?? 0);
    const attackRolls = [0.999, 0, 0];
    const result = resolveFirstEncounterTurn(encounter, () => attackRolls.shift() ?? 0);

    expect(encounter.turn).toBe('slime');
    expect(result.actor).toBe('slime');
    expect(result.state).toMatchObject({ phase: 'active', turn: 'hero', heroHp: 9, round: 2 });
  });
});
