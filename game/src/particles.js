// HONEYBEE rev4 — extra particle recipes for the polish pass.
// One job: small, named bursts the game triggers at lively moments:
// landing dust when the bee touches down on a bloom, a golden splash
// when honey is delivered, and petals that flutter off a clicked flower.
// Shapes are drawn by render.js (dot / rect / puff / petal); this file
// only decides what spawns, never how it looks on screen.

import { range } from './rng.js';

// Soft tan puffs that billow out and fade as the bee lands on a bloom.
export function dustPuff(world, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, 12, 42);
    world.particles.push({
      x: x + range(world.rng, -8, 8), y: y + range(world.rng, -2, 4),
      vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4 - 14,
      t: 0, life: range(world.rng, 0.45, 0.8),
      size: range(world.rng, 4, 7), color: i % 2 ? '#d8c49a' : '#cbb98a',
      grav: -24, shape: 'puff',
    });
  }
}

// Golden droplets that arc out of the hive mouth plus a few sparkles
// rising above them, fired the moment honey is delivered.
export function honeySplash(world, x, y) {
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + range(world.rng, -1.1, 1.1);
    const s = range(world.rng, 60, 170);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: range(world.rng, 0.55, 0.9),
      size: range(world.rng, 2, 4.5), color: i % 2 ? '#ffb400' : '#ffcf3d',
      grav: 330, shape: 'dot',
    });
  }
  for (let i = 0; i < 5; i++) {
    world.particles.push({
      x: x + range(world.rng, -22, 22), y: y + range(world.rng, -8, 8),
      vx: range(world.rng, -14, 14), vy: range(world.rng, -120, -55),
      t: 0, life: range(world.rng, 0.5, 0.85),
      size: range(world.rng, 2, 3), color: '#fff3a0',
      grav: -40, shape: 'dot',
    });
  }
}

// A firework rocket burst for the win screen: bright sparks that arc
// out, then rain down slowly, plus a quick white flash at the centre.
export function firework(world, x, y) {
  const colors = ['#ff5d8f', '#ffd23d', '#4cc9f0', '#80ed99', '#b388ff', '#ff9f1c'];
  const c = colors[Math.floor(world.rng() * colors.length)];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + world.rng() * 0.3;
    const s = range(world.rng, 60, 240);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: range(world.rng, 0.8, 1.5),
      size: range(world.rng, 2, 4), color: i % 5 === 0 ? '#ffffff' : c,
      grav: 90, shape: 'dot',
    });
  }
  world.particles.push({
    x, y, vx: 0, vy: 0, t: 0, life: 0.25, size: 14, color: '#ffffff',
    grav: 0, shape: 'dot',
  });
}

// A few petals that flutter away from a bloom, light enough to ride
// the wind for a second before settling.
export function petalBurst(world, x, y, color) {
  const colors = color ? [color] : ['#ffb3c7', '#ffffff', '#ffd6e5'];
  for (let i = 0; i < 4; i++) {
    world.particles.push({
      x: x + range(world.rng, -6, 6), y: y + range(world.rng, -6, 6),
      vx: range(world.rng, -34, 34), vy: range(world.rng, -26, 8),
      t: 0, life: range(world.rng, 1.1, 1.8),
      size: range(world.rng, 4, 6.5),
      color: colors[Math.floor(world.rng() * colors.length)],
      grav: 26, shape: 'petal', rot: world.rng() * Math.PI,
    });
  }
}
