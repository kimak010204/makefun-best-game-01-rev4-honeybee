// HONEYBEE rev4 — a soft camera (polish pass 4).
// One job: drift the world a few pixels toward where the bee is going,
// so flight feels like moving through the meadow instead of sliding
// across a postcard. Pure function of world state + dt, so a fixed
// seed replays exactly. Only active while playing; it eases back to
// dead centre on menus and end screens, where clicks and panels must
// stay exactly where the player expects them.

import { VIEW } from './config.js';
import { clamp } from './rng.js';

export const CAM_MAX_X = 16;
export const CAM_MAX_Y = 10;

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(world, dt) {
  const cam = world.cam;
  if (!cam) return;
  let tx = 0, ty = 0;
  if (world.phase === 'playing') {
    const bee = world.bee;
    tx = clamp((bee.x - VIEW.W / 2) * 0.03 + bee.vx * 0.02, -CAM_MAX_X, CAM_MAX_X);
    ty = clamp((bee.y - VIEW.H / 2) * 0.02 + bee.vy * 0.015, -CAM_MAX_Y, CAM_MAX_Y);
  }
  const k = 1 - Math.exp(-2.2 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}
