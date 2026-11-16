// HONEYBEE rev4 — world state and spawning.
// One job: build a fresh game state and keep the meadow stocked with
// flowers, wasps, webs and power-ups. No drawing, no input here.

import { VIEW, GROUND_Y, HIVE, POUCH_MAX, HONEY_GOAL, DIFFICULTY, FLOWERS, WASP_KINDS } from './config.js';
import { makeRng, range, pick, pickWeighted, clamp } from './rng.js';
import { createAmbient } from './ambient.js';
import { createShowtime } from './showtime.js';
import { createCamera } from './camera.js';

export function createWorld(seed, difficultyKey) {
  const diff = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const rng = makeRng(seed);
  const world = {
    seed,
    difficultyKey,
    diff,
    rng,
    phase: 'title', // title | playing | paused | win | lose
    time: 0, // wall time inside the current phase
    timeLeft: diff.time,
    honey: 0,
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    delivered: 0, // pollen units delivered to the hive
    collected: 0, // pollen units picked from flowers
    queenSpawned: false,
    queenBeaten: false,
    shake: 0,
    flash: 0,
    banner: null, // { text, sub, t, dur, color }
    stats: null, // end-of-game summary
    bee: {
      x: 240, y: 300, vx: 0, vy: 0, angle: 0, wing: 0,
      pouch: 0, invuln: 0, slow: 0, swift: 0, shield: false, magnet: 0,
    },
    flowers: [],
    wasps: [],
    webs: [],
    powerups: [],
    particles: [],
    popups: [],
    birds: [],
    queen: null,
    powerupTimer: diff.powerupEvery,
    waspTimer: 4,
    best: 0,
  };
  try { world.best = Number(localStorage.getItem('honeybee-best') || 0); } catch { world.best = 0; }

  // Meadow: 16 flower beds across the grass, none inside the hive tree.
  for (let i = 0; i < 16; i++) {
    const f = makeFlower(world, range(rng, 60, 1020), range(rng, GROUND_Y + 40, 690));
    if (f.x < 290 && f.y > 645) f.x += 260; // keep the pond clear
    world.flowers.push(f);
  }
  // A few tall sunflowers stand at the back of the meadow.
  for (let i = 0; i < 3; i++) {
    const f = makeFlower(world, range(rng, 120, 960), range(rng, GROUND_Y + 8, GROUND_Y + 30));
    f.kind = 'sunflower';
    world.flowers.push(f);
  }
  for (let i = 0; i < diff.webCount; i++) world.webs.push(makeWeb(world));
  for (let i = 0; i < diff.waspStart; i++) world.wasps.push(makeWasp(world, 'patroller'));
  for (let i = 0; i < 3; i++) {
    world.birds.push({ x: range(rng, 0, VIEW.W), y: range(rng, 60, 180), v: range(rng, 18, 34), ph: range(rng, 0, 6) });
  }
  world.ambient = createAmbient(world);
  world.showtime = createShowtime(world);
  world.cam = createCamera();
  return world;
}

export function makeFlower(world, x, y) {
  const kinds = Object.entries(FLOWERS).map(([kind, def]) => ({ kind, weight: def.weight }));
  const kind = pickWeighted(world.rng, kinds).kind;
  return {
    kind, x, y, pollen: FLOWERS[kind].value, maxPollen: FLOWERS[kind].value,
    regrow: 0, sway: world.rng() * Math.PI * 2, sparkle: world.rng() * Math.PI * 2,
  };
}

function makeWasp(world, kind) {
  const def = WASP_KINDS[kind];
  const side = world.rng() < 0.5 ? -40 : VIEW.W + 40;
  return {
    kind, x: side, y: range(world.rng, 120, 480),
    vx: 0, vy: 0, r: def.r, speed: world.diff.waspSpeed * def.speed,
    ph: world.rng() * Math.PI * 2, state: 'enter', stateT: 0,
    dashX: 0, dashY: 0, wing: 0,
  };
}

function makeWeb(world) {
  const x = range(world.rng, 140, 1000);
  const y = range(world.rng, GROUND_Y + 30, 660);
  return { x, y, r: range(world.rng, 42, 58), rot: world.rng() * Math.PI, age: 0 };
}

export function spawnPowerup(world) {
  const kinds = ['swift', 'shield', 'magnet'];
  const kind = pick(world.rng, kinds);
  world.powerups.push({
    kind, x: range(world.rng, 120, 1040), y: range(world.rng, 140, 480),
    t: 0, life: 14, bob: world.rng() * Math.PI * 2,
  });
}

export function spawnQueen(world) {
  world.queenSpawned = true;
  world.queen = {
    x: VIEW.W + 80, y: 130, vx: 0, vy: 0, r: 34,
    divesLeft: world.diff.queenDives, state: 'enter', stateT: 0,
    targetX: 0, targetY: 0, wing: 0, flash: 0,
  };
  world.banner = { text: '👑 THE HORNET QUEEN HAS COME!', sub: 'Dodge her dives — survive to send her packing', t: 0, dur: 3.2, color: '#7b2d8b' };
  if (world.showtime) world.showtime.queenIntro = 1.4; // cinematic dim + zoom
}

export function addPopup(world, x, y, text, color, big = false) {
  world.popups.push({ x, y, text, color, t: 0, life: big ? 1.4 : 1.0, big });
}

export function burst(world, x, y, color, n, speed, life = 0.7) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
      t: 0, life: range(world.rng, life * 0.6, life),
      size: range(world.rng, 2, 5), color, grav: 160, shape: 'dot',
    });
  }
}

export function confetti(world, n) {
  const colors = ['#ff5d8f', '#ffd23d', '#4cc9f0', '#80ed99', '#b388ff', '#ff9f1c'];
  for (let i = 0; i < n; i++) {
    world.particles.push({
      x: range(world.rng, 0, VIEW.W), y: range(world.rng, -40, -4),
      vx: range(world.rng, -30, 30), vy: range(world.rng, 60, 160),
      t: 0, life: range(world.rng, 2.2, 3.4), size: range(world.rng, 4, 8),
      color: pick(world.rng, colors), grav: 40, shape: 'rect', rot: world.rng() * Math.PI,
    });
  }
}

export function restockWasps(world) {
  // The meadow gets busier as the jar fills: wasp cap grows with honey.
  const cap = Math.min(
    world.diff.waspMax,
    world.diff.waspStart + Math.floor(world.honey / 25),
  );
  if (world.wasps.length < cap) {
    const kinds = ['chaser', 'patroller', 'ambusher'];
    world.wasps.push(makeWasp(world, pick(world.rng, kinds)));
  }
}

export function flowerAt(world, x, y, radius) {
  let bestF = null, bestD = radius * radius;
  for (const f of world.flowers) {
    if (f.pollen <= 0) continue;
    const dx = f.x - x, dy = f.y - 18 - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestF = f; }
  }
  return bestF;
}

export { HIVE, POUCH_MAX, HONEY_GOAL, clamp };
