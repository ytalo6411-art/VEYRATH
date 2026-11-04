# Phaser boundary

Phaser owns world rendering, camera, tile/map data, movement visuals, collisions and sprites. React owns surrounding navigation, forms, character sheets and panels. Rules and authoritative state belong in `src/engine` and, for live cloud play, validated server/database operations.

The Phaser 3 runtime factory is established in `core/GameRuntime.ts`. No scene or map is marked playable in the foundation phase. Add asset loading only after package audit and manifest approval; do not put database polling or combat rule calculations in a Phaser update loop.
