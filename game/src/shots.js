// HONEYBEE rev4 — deterministic screenshot scenes.
// One job: build a fixed, lively snapshot of the game for each shot
// (?shot=start|play|win|lose&seed=N), so the screenshots are real renders
// of the game's own code and replay exactly from the seed.

import { createWorld, addPopup, burst, confetti } from './world.js';
import { HONEY_GOAL } from './config.js';

export function buildShotWorld(scene, seed) {
  const world = createWorld(seed, 'normal');
  world.time = 12; // a meadow already in motion

  if (scene === 'start') {
    world.phase = 'title';
    world.difficultyKey = 'normal';
    return world;
  }

  if (scene === 'play') {
    world.phase = 'playing';
    world.timeLeft = 44;
    world.honey = 82;
    world.score = 2100;
    world.lives = 3;
    world.combo = 3;
    world.comboTimer = 2.6;
    world.bestCombo = 4;
    world.bee.x = 470; world.bee.y = 330;
    world.bee.vx = 120; world.bee.vy = -40;
    world.bee.pouch = 4;
    world.bee.swift = 4;
    // A queen mid-fight, wasps closing in, one power-up glowing.
    world.queenSpawned = true;
    world.queen = {
      x: 980, y: 150, vx: -40, vy: 20, r: 34, divesLeft: 2,
      state: 'aim', stateT: 0.6, targetX: 470, targetY: 330, wing: 2, flash: 0,
    };
    world.wasps.push(
      { kind: 'chaser', x: 240, y: 210, vx: 90, vy: 30, r: 15, speed: 150, ph: 0, state: 'hunt', stateT: 0, dashX: 0, dashY: 0, wing: 1 },
      { kind: 'patroller', x: 700, y: 180, vx: -60, vy: 20, r: 14, speed: 120, ph: 1, state: 'hunt', stateT: 0, dashX: 0, dashY: 0, wing: 2 },
      { kind: 'ambusher', x: 850, y: 420, vx: 0, vy: 0, r: 16, speed: 190, ph: 0, state: 'hunt', stateT: 1.25, dashX: 0, dashY: 0, wing: 0 },
    );
    world.powerups.push({ kind: 'shield', x: 620, y: 210, t: 1, life: 12, bob: 0 });
    addPopup(world, 470, 280, '+30', '#7a4a12');
    addPopup(world, 470, 250, 'COMBO x3!', '#e85d04', true);
    burst(world, 300, 480, '#ffd23d', 6, 60);
    return world;
  }

  if (scene === 'win') {
    world.phase = 'win';
    world.honey = HONEY_GOAL;
    world.score = 4860;
    world.lives = 3;
    world.timeLeft = 41;
    world.bee.x = 1000; world.bee.y = 320;
    world.queenBeaten = true;
    world.stats = {
      won: true, reason: 'The hive overflows with honey.',
      score: 4860, honey: 100, delivered: 100, collected: 118,
      bestCombo: 5, timeBonus: 205, timeLeft: 41, queenBeaten: true,
    };
    world.best = 4860;
    confetti(world, 80);
    // One deterministic burst in the open sky at top-left, beside the end
    // panel (which spans roughly x 350-920), so it is actually visible in
    // the win screenshot instead of hiding behind the panel. It fires 45
    // frames into the shot (update() counts it down): fired at t=0 it
    // would already be faded by the time the shot is captured at 50 frames,
    // and at 45 the flash is still alive at capture.
    world.shotBurstIn = 45;
    return world;
  }

  // lose
  world.phase = 'lose';
  world.honey = 47;
  world.score = 980;
  world.lives = 0;
  world.timeLeft = 0;
  world.bee.x = 640; world.bee.y = 380;
  world.stats = {
    won: false, reason: 'The sun set before the hive was full.',
    score: 980, honey: 47, delivered: 47, collected: 52,
    bestCombo: 3, timeBonus: 0, timeLeft: 0, queenBeaten: false,
  };
  world.best = 4860;
  return world;
}
