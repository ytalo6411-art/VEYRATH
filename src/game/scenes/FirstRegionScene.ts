import Phaser from 'phaser';
import { FIRST_REGION } from '../world/firstRegionData';
import type { LocalAdventureState } from '../../services/game/localAdventureStore';

type StepDirection = 'up' | 'right' | 'down' | 'left';
type InteractableId = 'lira' | 'marsh-slime' | 'camp';

const STEP: Record<StepDirection, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  right: { col: 1, row: 0 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
};

const TERRAIN_COLOR: Record<string, number> = {
  g: 0x385a3d,
  p: 0x78694b,
  w: 0x28515a,
  r: 0x55594b,
};

export class FirstRegionScene extends Phaser.Scene {
  private readonly initialState: LocalAdventureState;
  private terrain?: Phaser.GameObjects.Graphics;
  private readonly objects = new Map<string, Phaser.GameObjects.Container>();
  private player?: Phaser.GameObjects.Container;
  private prompt?: Phaser.GameObjects.Text;
  private position: { col: number; row: number };
  private tileWidth: number = FIRST_REGION.tileWidth;
  private tileHeight: number = FIRST_REGION.tileHeight;
  private originX = 0;
  private originY = 0;
  private isMoving = false;
  private controlsLocked = false;
  private slimeDefeated = false;
  private nearby: InteractableId | null = null;

  constructor(initialState: LocalAdventureState) {
    super({ key: 'FirstRegionScene' });
    this.initialState = initialState;
    this.position = { col: initialState.col, row: initialState.row };
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111a17');
    this.terrain = this.add.graphics();
    this.terrain.setDepth(-1000);

    for (const object of FIRST_REGION.objects) {
      if (object.kind === 'tree') this.objects.set(object.id, this.createTree());
      if (object.kind === 'rock') this.objects.set(object.id, this.createRock());
      if (object.kind === 'npc') this.objects.set(object.id, this.createLira());
      if (object.kind === 'creature') this.objects.set(object.id, this.createSlime());
      if (object.kind === 'camp') this.objects.set(object.id, this.createCamp());
    }
    this.player = this.createHero();

    if (this.initialState.slimeHp === 0) {
      this.slimeDefeated = true;
      this.objects.get('marsh-slime')?.setVisible(false);
    }

    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f0d6a3',
      backgroundColor: '#162019',
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
      stroke: '#101510',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(10000);

    this.input.keyboard?.on('keydown-UP', () => this.step('up'));
    this.input.keyboard?.on('keydown-W', () => this.step('up'));
    this.input.keyboard?.on('keydown-RIGHT', () => this.step('right'));
    this.input.keyboard?.on('keydown-D', () => this.step('right'));
    this.input.keyboard?.on('keydown-DOWN', () => this.step('down'));
    this.input.keyboard?.on('keydown-S', () => this.step('down'));
    this.input.keyboard?.on('keydown-LEFT', () => this.step('left'));
    this.input.keyboard?.on('keydown-A', () => this.step('left'));
    this.input.keyboard?.on('keydown-E', () => this.interact());

    this.game.events.on('world:step', this.handleUiStep, this);
    this.game.events.on('world:interact-request', this.interact, this);
    this.game.events.on('world:request-state', this.emitWorldState, this);
    this.game.events.on('world:teleport', this.handleTeleport, this);
    this.game.events.on('world:slime-defeated', this.handleSlimeDefeated, this);
    this.game.events.on('world:lock-controls', this.handleControlLock, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.layout();
    this.time.delayedCall(40, () => this.emitWorldState());
  }

  private readonly handleUiStep = (direction: StepDirection) => this.step(direction);

  private readonly handleTeleport = (position: { col: number; row: number }) => {
    if (!this.player || !this.isWalkable(position.col, position.row)) return;
    this.position = position;
    const point = this.toScreen(position.col, position.row);
    this.player.setPosition(point.x, point.y);
    this.player.setDepth(point.y + 20);
    this.emitPosition();
    this.refreshNearby();
  };

  private readonly handleSlimeDefeated = () => {
    this.slimeDefeated = true;
    this.objects.get('marsh-slime')?.setVisible(false);
    this.refreshNearby();
  };

  private readonly handleControlLock = (locked: boolean) => {
    this.controlsLocked = Boolean(locked);
  };

  private readonly emitWorldState = () => {
    this.emitPosition();
    this.refreshNearby();
  };

  private readonly shutdown = () => {
    this.game.events.off('world:step', this.handleUiStep, this);
    this.game.events.off('world:interact-request', this.interact, this);
    this.game.events.off('world:request-state', this.emitWorldState, this);
    this.game.events.off('world:teleport', this.handleTeleport, this);
    this.game.events.off('world:slime-defeated', this.handleSlimeDefeated, this);
    this.game.events.off('world:lock-controls', this.handleControlLock, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
  };

  private layout(): void {
    if (!this.sys.isActive()) return;
    const width = Math.max(320, this.scale.width);
    const height = Math.max(300, this.scale.height);
    const stepsAcross = (FIRST_REGION.columns + FIRST_REGION.rows - 2) / 2;
    this.tileWidth = Math.min(FIRST_REGION.tileWidth, (width - 28) / stepsAcross);
    this.tileHeight = this.tileWidth / 2;
    const horizontalCenterOffset = (FIRST_REGION.columns - FIRST_REGION.rows) * this.tileWidth / 4;
    const mapHeight = (FIRST_REGION.columns + FIRST_REGION.rows - 2) * this.tileHeight / 2;
    this.originX = width / 2 - horizontalCenterOffset;
    this.originY = Math.max(22, (height - mapHeight) / 2);

    this.drawTerrain();
    for (const object of FIRST_REGION.objects) {
      const visual = this.objects.get(object.id);
      if (!visual) continue;
      const point = this.toScreen(object.col, object.row);
      visual.setPosition(point.x, point.y);
      visual.setDepth(point.y + 15);
    }
    if (this.player) {
      const point = this.toScreen(this.position.col, this.position.row);
      this.player.setPosition(point.x, point.y);
      this.player.setDepth(point.y + 20);
    }
    this.refreshPrompt();
  }

  private drawTerrain(): void {
    if (!this.terrain) return;
    this.terrain.clear();
    for (let row = 0; row < FIRST_REGION.rows; row += 1) {
      for (let col = 0; col < FIRST_REGION.columns; col += 1) {
        const tile = FIRST_REGION.tiles[row]?.[col] ?? 'g';
        const point = this.toScreen(col, row);
        const shade = tile === 'g' ? ((col * 5 + row * 3) % 5) * 0x010402 : 0;
        const color = TERRAIN_COLOR[tile] ?? TERRAIN_COLOR.g ?? 0x385a3d;
        const halfWidth = this.tileWidth / 2;
        const halfHeight = this.tileHeight / 2;
        const diamond = [
          new Phaser.Geom.Point(point.x, point.y - halfHeight),
          new Phaser.Geom.Point(point.x + halfWidth, point.y),
          new Phaser.Geom.Point(point.x, point.y + halfHeight),
          new Phaser.Geom.Point(point.x - halfWidth, point.y),
        ];
        this.terrain.fillStyle(color + shade, 1);
        this.terrain.fillPoints(diamond, true);
        this.terrain.lineStyle(1, tile === 'w' ? 0x78a2a0 : 0x92a081, 0.16);
        this.terrain.strokePoints(diamond, true);

        if (tile === 'p' && (col + row) % 3 === 0) {
          this.terrain.fillStyle(0xc0a274, 0.28);
          this.terrain.fillRect(point.x - 2, point.y - 1, 4, 2);
        } else if (tile === 'g' && (col * 7 + row * 11) % 9 === 0) {
          this.terrain.fillStyle(0xb1c17d, 0.62);
          this.terrain.fillRect(point.x - 1, point.y - 1, 2, 2);
        }
        if (tile === 'w') {
          this.terrain.lineStyle(1, 0x8fc0b8, 0.26);
          this.terrain.lineBetween(point.x - halfWidth * 0.35, point.y, point.x + halfWidth * 0.18, point.y - halfHeight * 0.12);
        }
      }
    }
  }

  private createTree(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x17231b, 0.52).fillEllipse(0, -1, 36, 12);
    graphic.fillStyle(0x5d4730, 1).fillRect(-4, -37, 8, 37);
    graphic.fillStyle(0x304a34, 1).fillPoints([
      new Phaser.Geom.Point(0, -66), new Phaser.Geom.Point(18, -42), new Phaser.Geom.Point(13, -25),
      new Phaser.Geom.Point(-13, -25), new Phaser.Geom.Point(-18, -42),
    ], true);
    graphic.fillStyle(0x527346, 1).fillPoints([
      new Phaser.Geom.Point(0, -62), new Phaser.Geom.Point(12, -43), new Phaser.Geom.Point(9, -31),
      new Phaser.Geom.Point(-8, -31), new Phaser.Geom.Point(-12, -45),
    ], true);
    graphic.fillStyle(0x829454, 1).fillRect(-3, -53, 5, 5).fillRect(6, -43, 4, 3).fillRect(-10, -40, 4, 3);
    return this.add.container(0, 0, [graphic]);
  }

  private createRock(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x17211c, 0.48).fillEllipse(0, -1, 28, 9);
    graphic.fillStyle(0x596056, 1).fillPoints([
      new Phaser.Geom.Point(-14, -4), new Phaser.Geom.Point(-10, -18), new Phaser.Geom.Point(0, -25),
      new Phaser.Geom.Point(13, -17), new Phaser.Geom.Point(15, -5),
    ], true);
    graphic.fillStyle(0x828778, 0.8).fillPoints([
      new Phaser.Geom.Point(-7, -15), new Phaser.Geom.Point(0, -23), new Phaser.Geom.Point(6, -16), new Phaser.Geom.Point(1, -12),
    ], true);
    return this.add.container(0, 0, [graphic]);
  }

  private createLira(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x151d18, 0.54).fillEllipse(0, -1, 24, 8);
    graphic.fillStyle(0x788b5c, 1).fillRect(-7, -28, 14, 20);
    graphic.fillStyle(0xc89d70, 1).fillRect(-5, -38, 10, 11);
    graphic.fillStyle(0x3b3025, 1).fillRect(-6, -40, 12, 4);
    graphic.fillStyle(0xd9c493, 1).fillRect(-2, -21, 4, 4).fillRect(-2, -11, 4, 4);
    const name = this.add.text(0, -48, 'LIRA', { fontFamily: 'monospace', fontSize: '8px', color: '#eed6a8' }).setOrigin(0.5);
    return this.add.container(0, 0, [graphic, name]);
  }

  private createSlime(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x151c17, 0.52).fillEllipse(0, -1, 30, 9);
    graphic.fillStyle(0x4b9e83, 1).fillPoints([
      new Phaser.Geom.Point(-14, -5), new Phaser.Geom.Point(-13, -15), new Phaser.Geom.Point(-7, -22),
      new Phaser.Geom.Point(3, -25), new Phaser.Geom.Point(12, -18), new Phaser.Geom.Point(14, -5),
    ], true);
    graphic.fillStyle(0x81c19c, 0.9).fillRect(-4, -19, 5, 4).fillRect(6, -12, 3, 3);
    graphic.fillStyle(0x15251c, 1).fillRect(-7, -14, 3, 4).fillRect(5, -14, 3, 4);
    return this.add.container(0, 0, [graphic]);
  }

  private createCamp(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x171b14, 0.48).fillEllipse(0, -1, 27, 8);
    graphic.lineStyle(3, 0x7c6343, 1).lineBetween(-8, -8, 7, -2).lineBetween(-7, -2, 8, -9);
    graphic.fillStyle(0xe29550, 1).fillPoints([
      new Phaser.Geom.Point(0, -4), new Phaser.Geom.Point(-4, -11), new Phaser.Geom.Point(1, -19),
      new Phaser.Geom.Point(5, -10),
    ], true);
    graphic.fillStyle(0xf4c46d, 1).fillPoints([
      new Phaser.Geom.Point(0, -6), new Phaser.Geom.Point(-1, -13), new Phaser.Geom.Point(3, -8),
    ], true);
    const name = this.add.text(0, -25, 'ACAMPAMENTO', { fontFamily: 'monospace', fontSize: '6px', color: '#d2b987' }).setOrigin(0.5);
    return this.add.container(0, 0, [graphic, name]);
  }

  private createHero(): Phaser.GameObjects.Container {
    const graphic = this.add.graphics();
    graphic.fillStyle(0x101914, 0.58).fillEllipse(0, -1, 23, 7);
    graphic.fillStyle(0x345c6a, 1).fillRect(-6, -25, 12, 17);
    graphic.fillStyle(0xc89a70, 1).fillRect(-4, -34, 8, 10);
    graphic.fillStyle(0x342d29, 1).fillRect(-5, -37, 10, 4);
    graphic.fillStyle(0x9f7652, 1).fillRect(-7, -10, 5, 6).fillRect(2, -10, 5, 6);
    graphic.fillStyle(0xd4bc8e, 1).fillRect(-1, -22, 3, 7);
    return this.add.container(0, 0, [graphic]);
  }

  private toScreen(col: number, row: number): { x: number; y: number } {
    return {
      x: this.originX + (col - row) * this.tileWidth / 2,
      y: this.originY + (col + row) * this.tileHeight / 2,
    };
  }

  private isWalkable(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= FIRST_REGION.columns || row >= FIRST_REGION.rows) return false;
    const tile = FIRST_REGION.tiles[row]?.[col];
    if (!tile || tile === 'w' || tile === 'r') return false;
    return !FIRST_REGION.objects.some((object) => object.blocksMovement
      && object.col === col
      && object.row === row
      && (object.id !== 'marsh-slime' || !this.slimeDefeated));
  }

  private step(direction: StepDirection): void {
    if (this.isMoving || this.controlsLocked || !this.player) return;
    const offset = STEP[direction];
    const col = this.position.col + offset.col;
    const row = this.position.row + offset.row;
    if (!this.isWalkable(col, row)) {
      this.game.events.emit('world:blocked');
      return;
    }

    const nextPosition = { col, row };
    const point = this.toScreen(col, row);
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: point.x,
      y: point.y,
      duration: 145,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.position = nextPosition;
        this.isMoving = false;
        this.player?.setDepth(point.y + 20);
        this.emitPosition();
        this.refreshNearby();
      },
    });
  }

  private interact(): void {
    if (this.controlsLocked) return;
    if (!this.nearby) {
      this.game.events.emit('world:message', 'Chegue mais perto de alguém ou de algo para interagir.');
      return;
    }
    this.game.events.emit('world:interaction', { target: this.nearby });
  }

  private refreshNearby(): void {
    const targets = FIRST_REGION.objects.filter((object) => object.kind === 'npc' || object.kind === 'creature' || object.kind === 'camp');
    const nearest = targets
      .filter((object) => object.id !== 'marsh-slime' || !this.slimeDefeated)
      .map((object) => ({ object, distance: Math.abs(object.col - this.position.col) + Math.abs(object.row - this.position.row) }))
      .filter((entry) => entry.distance <= 1)
      .sort((left, right) => left.distance - right.distance)[0]?.object;

    this.nearby = nearest?.id === 'lira' || nearest?.id === 'marsh-slime' || nearest?.id === 'camp' ? nearest.id : null;
    this.refreshPrompt();
    this.game.events.emit('world:nearby', this.nearby);
  }

  private refreshPrompt(): void {
    if (!this.prompt || !this.player) return;
    const label = this.nearby === 'lira' ? 'E  CONVERSAR'
      : this.nearby === 'marsh-slime' ? 'E  ENFRENTAR'
        : this.nearby === 'camp' ? 'E  EXAMINAR'
          : '';
    this.prompt.setText(label);
    this.prompt.setPosition(this.player.x, this.player.y - 45);
    this.prompt.setVisible(Boolean(label));
  }

  private emitPosition(): void {
    this.game.events.emit('world:position', { ...this.position });
  }
}
