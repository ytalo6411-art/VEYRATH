import Phaser from 'phaser';
import { createGameConfig } from '../config/gameConfig';

/** Lifecycle wrapper for embedding Phaser in React-owned screen containers. */
export class GameRuntime {
  readonly game: Phaser.Game;

  constructor(parent: HTMLElement, scenes: Phaser.Types.Scenes.SceneType[] = []) {
    this.game = new Phaser.Game(createGameConfig(parent, scenes));
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
