export type RandomSource = () => number;

export interface AttackInput {
  attackBonus: number;
  defense: number;
  damageDie: 4 | 6 | 8 | 10 | 12;
  damageBonus: number;
}

export interface AttackResult {
  natural: number;
  total: number;
  hit: boolean;
  critical: boolean;
  damageRolls: number[];
  damage: number;
}

export function rollDie(sides: number, random: RandomSource = Math.random): number {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new Error('Um dado precisa ter ao menos dois lados inteiros.');
  }

  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('A fonte aleatória deve retornar um número no intervalo [0, 1).');
  }
  return Math.floor(sample * sides) + 1;
}

export function resolveAttack(input: AttackInput, random: RandomSource = Math.random): AttackResult {
  const natural = rollDie(20, random);
  const total = natural + input.attackBonus;
  const critical = natural === 20;
  const hit = critical || (natural !== 1 && total >= input.defense);

  if (!hit) {
    return { natural, total, hit: false, critical: false, damageRolls: [], damage: 0 };
  }

  const damageRolls = [rollDie(input.damageDie, random)];
  if (critical) damageRolls.push(rollDie(input.damageDie, random));
  const damage = damageRolls.reduce((sum, value) => sum + value, input.damageBonus);

  return { natural, total, hit: true, critical, damageRolls, damage };
}
