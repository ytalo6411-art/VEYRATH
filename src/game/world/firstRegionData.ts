export type RegionTile = 'g' | 'p' | 'w' | 'r';
export type RegionObjectKind = 'tree' | 'rock' | 'npc' | 'creature' | 'camp';

export interface RegionObject {
  id: string;
  kind: RegionObjectKind;
  col: number;
  row: number;
  blocksMovement?: boolean;
}

export const FIRST_REGION = {
  id: 'clareira-da-vigilia',
  name: 'Clareira da Vigília',
  subtitle: 'Margens do Brejo de Varda',
  columns: 13,
  rows: 11,
  tileWidth: 56,
  tileHeight: 28,
  tiles: [
    'ggggggggggggg',
    'gggggggggwwgg',
    'ggggggggwwrgg',
    'gggpppgggppgg',
    'ggggppggggggg',
    'gggppgggggggg',
    'ggppggggggggg',
    'ggppggggggggg',
    'ggppggggggggg',
    'ggppggggggggg',
    'ggggggggggggg',
  ] as const,
  start: { col: 2, row: 8 },
  objects: [
    { id: 'camp', kind: 'camp', col: 2, row: 8 },
    { id: 'lira', kind: 'npc', col: 5, row: 3, blocksMovement: true },
    { id: 'marsh-slime', kind: 'creature', col: 9, row: 5, blocksMovement: true },
    { id: 'tree-01', kind: 'tree', col: 1, row: 1, blocksMovement: true },
    { id: 'tree-02', kind: 'tree', col: 4, row: 1, blocksMovement: true },
    { id: 'tree-03', kind: 'tree', col: 0, row: 4, blocksMovement: true },
    { id: 'tree-04', kind: 'tree', col: 7, row: 1, blocksMovement: true },
    { id: 'tree-05', kind: 'tree', col: 11, row: 4, blocksMovement: true },
    { id: 'tree-06', kind: 'tree', col: 6, row: 8, blocksMovement: true },
    { id: 'rock-01', kind: 'rock', col: 10, row: 2, blocksMovement: true },
    { id: 'rock-02', kind: 'rock', col: 10, row: 7, blocksMovement: true },
  ] satisfies RegionObject[],
} as const;
