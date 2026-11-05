import { describe, expect, it } from 'vitest';
import { FIRST_REGION } from '../../src/game/world/firstRegionData';

const DIRECTIONS = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

function canReachInteractionTarget(targetId: string): boolean {
  const target = FIRST_REGION.objects.find((object) => object.id === targetId);
  if (!target) return false;
  const queue: Array<{ col: number; row: number }> = [FIRST_REGION.start];
  const visited = new Set([`${FIRST_REGION.start.col},${FIRST_REGION.start.row}`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Math.abs(current.col - target.col) + Math.abs(current.row - target.row) <= 1) return true;

    for (const direction of DIRECTIONS) {
      const col = current.col + direction.col;
      const row = current.row + direction.row;
      const key = `${col},${row}`;
      const tile = FIRST_REGION.tiles[row]?.[col];
      if (visited.has(key) || !tile || tile === 'w' || tile === 'r') continue;
      if (FIRST_REGION.objects.some((object) => object.blocksMovement && object.col === col && object.row === row)) continue;
      visited.add(key);
      queue.push({ col, row });
    }
  }

  return false;
}

describe('Clareira da Vigília region data', () => {
  it('has a finite rectangular tile grid matching the declared dimensions', () => {
    expect(FIRST_REGION.tiles).toHaveLength(FIRST_REGION.rows);
    for (const row of FIRST_REGION.tiles) expect(row).toHaveLength(FIRST_REGION.columns);
  });

  it('has a walkable path from camp to Lira and the slime encounter', () => {
    expect(canReachInteractionTarget('camp')).toBe(true);
    expect(canReachInteractionTarget('lira')).toBe(true);
    expect(canReachInteractionTarget('marsh-slime')).toBe(true);
  });
});
