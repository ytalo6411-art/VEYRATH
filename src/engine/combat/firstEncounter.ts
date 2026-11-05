import { resolveAttack, rollDie } from '../rules/d20';
import type { AttackResult, RandomSource } from '../rules/d20';

export type CombatTurn = 'hero' | 'slime';
export type CombatPhase = 'active' | 'victory' | 'defeat';

export interface FirstEncounterState {
  phase: CombatPhase;
  turn: CombatTurn;
  round: number;
  heroHp: number;
  heroMaxHp: number;
  slimeHp: number;
  slimeMaxHp: number;
  heroInitiative: number;
  slimeInitiative: number;
  lastAction: string;
}

export interface TurnResolution {
  state: FirstEncounterState;
  attack: AttackResult;
  actor: CombatTurn;
}

export function beginFirstEncounter(
  heroHp: number,
  heroMaxHp: number,
  slimeHp: number,
  random: RandomSource = Math.random,
): FirstEncounterState {
  const heroInitiative = rollDie(20, random) + 2;
  const slimeInitiative = rollDie(20, random) + 1;
  const turn: CombatTurn = heroInitiative >= slimeInitiative ? 'hero' : 'slime';

  return {
    phase: 'active',
    turn,
    round: 1,
    heroHp: clamp(heroHp, 0, heroMaxHp),
    heroMaxHp,
    slimeHp: clamp(slimeHp, 0, 7),
    slimeMaxHp: 7,
    heroInitiative,
    slimeInitiative,
    lastAction: turn === 'hero' ? 'Você age primeiro.' : 'O lodo se move antes de você.',
  };
}

export function resolveFirstEncounterTurn(
  current: FirstEncounterState,
  random: RandomSource = Math.random,
): TurnResolution {
  if (current.phase !== 'active') throw new Error('Este encontro já terminou.');

  if (current.turn === 'hero') {
    const attack = resolveAttack({ attackBonus: 4, defense: 11, damageDie: 6, damageBonus: 2 }, random);
    const slimeHp = Math.max(0, current.slimeHp - attack.damage);
    const phase: CombatPhase = slimeHp === 0 ? 'victory' : 'active';
    const action = attack.hit
      ? `Seu ataque ${attack.critical ? 'crítico ' : ''}acerta: ${attack.damage} de dano.`
      : `Seu ataque erra (${attack.natural} no D20).`;

    return {
      actor: 'hero',
      attack,
      state: {
        ...current,
        phase,
        turn: phase === 'active' ? 'slime' : 'hero',
        slimeHp,
        lastAction: phase === 'victory' ? `${action} O lodo se desfaz.` : action,
      },
    };
  }

  const attack = resolveAttack({ attackBonus: 2, defense: 13, damageDie: 4, damageBonus: 1 }, random);
  const heroHp = Math.max(0, current.heroHp - attack.damage);
  const phase: CombatPhase = heroHp === 0 ? 'defeat' : 'active';
  const action = attack.hit
    ? `O lodo acerta: ${attack.damage} de dano.`
    : `O lodo erra (${attack.natural} no D20).`;

  return {
    actor: 'slime',
    attack,
    state: {
      ...current,
      phase,
      turn: phase === 'active' ? 'hero' : 'slime',
      round: phase === 'active' ? current.round + 1 : current.round,
      heroHp,
      lastAction: phase === 'defeat' ? `${action} Você caiu.` : action,
    },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}
