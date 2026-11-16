// HONEYBEE rev4 — cinematic juice and visual wow (polish pass 3).
// One job: everything that makes the game feel like a top-10 entry
// without touching the rules: god rays and lens flare from the sun,
// a living foreground frame, leaves falling from the oak, a soft
// vignette, phase fade-ins, and the timers that drive hit-stop,
// slow motion, the queen's cinematic entrance and the honey slosh.
// All motion derives from world.time and the seeded rng, so a fixed
// seed replays exactly; the timers only ever fire on real game events
// (a sting, a delivery, the queen), never in a screenshot scene.

import { VIEW, SKY_KEYS } from './config.js';
import { clamp, lerp, hexLerp, range } from './rng.js';
import { dayProgressOf, windStrength } from './ambient.js';

export function createShowtime(world) {
  const rng = world.rng;
  const leaves = [];
  for (let i = 0; i < 14; i++) {
    leaves.push({
      x0: range(rng, 1000, 1230), // drift down from the oak canopy
      y0: range(rng, 130, 260),
      fall: range(rng, 14, 30),
      sway: range(rng, 10, 26),
      ph: range(rng, 0, Math.PI * 2),
      spin: range(rng, 0.6, 1.8),
      size: range(rng, 4, 7),
      color: rng() < 0.6 ? '#7cb35a' : '#a8c46a',
    });
  }
  return {
    hitStop: 0, // frozen frames right after a sting
    slowmo: 0, // dreamy slow motion while the bee recovers
    queenIntro: 0, // cinematic dim while the queen storms in
    slosh: 0, // honey-jar wobble right after a delivery
    leaves,
  };
}

// Black fade-in at the start of every phase (title, play, win, lose):
// 0.6 at the first frame, gone after 0.45s. Screenshot scenes sit at
// world.time = 12, so they never see the fade.
export function fadeAlpha(world) {
  if (world.time >= 0.45) return 0;
  return (1 - world.time / 0.45) * 0.6;
}

// Bloom growth 0..1 from the pollen left on it: a full bloom is whole,
// a half-picked one is smaller and tighter, an empty one is a sprout.
export function growthOf(f) {
  if (f.pollen <= 0) return 0;
  return 0.55 + 0.45 * (f.pollen / f.maxPollen);
}

// Where the sun sits right now, following the same sky keyframes as
// the palette: it climbs across the sky as the day ripens.
function sunPos(world) {
  const t = dayProgressOf(world);
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = clamp((t - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
  return {
    x: lerp(180, 1060, t),
    y: lerp(a.sunY, b.sunY, f) * VIEW.H,
    color: hexLerp(a.sun, b.sun, f),
  };
}

// Peak ray brightness 0..1 over the day: strongest at golden hour.
// Capped at 0.10 so the beams stay elegant and never veil the sky.
export function godRayStrength(t) {
  return 0.04 + 0.06 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5);
}

// God rays slanting down from the sun, strongest at golden hour, plus
// a shy lens flare along the sun-to-centre axis.
export function drawGodRays(ctx, world) {
  const t = dayProgressOf(world);
  const sun = sunPos(world);
  const strength = godRayStrength(t);
  const rays = [-0.5, -0.18, 0.12, 0.42, 0.72];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rays.length; i++) {
    const a = Math.PI / 2 + rays[i] + Math.sin(world.time * 0.11 + i) * 0.03;
    const len = 760;
    const ex = sun.x + Math.cos(a) * len;
    const ey = sun.y + Math.sin(a) * len;
    const g = ctx.createLinearGradient(sun.x, sun.y, ex, ey);
    g.addColorStop(0, `rgba(255,224,130,${strength.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 18 + (i % 2) * 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sun.x, sun.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  // Lens flare: three ghost circles trailing away from the sun.
  const cx = VIEW.W / 2, cy = VIEW.H / 2;
  for (let i = 0; i < 3; i++) {
    const f = 0.35 + i * 0.22;
    const fx = sun.x + (cx - sun.x) * f * 1.6;
    const fy = sun.y + (cy - sun.y) * f * 1.6;
    const r = 12 - i * 3;
    ctx.fillStyle = `rgba(255,240,180,${(0.10 - i * 0.025).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The frame: tall grass blades and a few big soft foreground blooms
// along the bottom edge, swaying with the wind, plus the oak leaves
// drifting down. Drawn late, so the meadow feels deep.
export function drawShowtimeFront(ctx, world) {
  const wind = windStrength(world);
  const t = world.time;

  // Falling leaves from the oak canopy.
  for (const lf of world.showtime.leaves) {
    const p = ((t * lf.fall + lf.ph * 47) % 560) / 560;
    const fade = Math.sin(p * Math.PI);
    if (fade < 0.05) continue;
    const x = lf.x0 + Math.sin(t * 0.7 + lf.ph) * lf.sway - p * 46;
    const y = lf.y0 + p * 480;
    ctx.save();
    ctx.globalAlpha = (fade * 0.9).toFixed(3);
    ctx.translate(x, y);
    ctx.rotate(t * lf.spin + lf.ph);
    ctx.fillStyle = lf.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, lf.size, lf.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A wasp nests in the oak: one of its guards circles the nest.
  const nx = 1000, ny = 222;
  const wa = t * 1.4;
  const wx = nx + Math.cos(wa) * 26;
  const wy = ny + Math.sin(wa * 1.7) * 12;
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(Math.sin(wa) * 0.3);
  ctx.fillStyle = '#3a2b12';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7b500';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 2, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(0, -6, 5, 2.6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Foreground grass: sparse, dark, tall blades along the bottom.
  ctx.strokeStyle = 'rgba(18,64,14,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 44; i++) {
    const x = (i * 137.5 + 31) % VIEW.W;
    const h = 16 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 22;
    const sway = Math.sin(t * 1.5 + i * 0.7) * (2 + wind * 5) + wind * 3;
    ctx.beginPath();
    ctx.moveTo(x, VIEW.H + 4);
    ctx.quadraticCurveTo(x + sway * 0.5, VIEW.H - h * 0.6, x + sway, VIEW.H - h);
    ctx.stroke();
  }
  // Three big soft foreground blooms, slightly out of focus.
  const fgFlowers = [
    { x: 330, c: '#ff8fb0' }, { x: 640, c: '#ffffff' }, { x: 950, c: '#c77dff' },
  ];
  for (let k = 0; k < fgFlowers.length; k++) {
    const f = fgFlowers[k];
    const sway = Math.sin(t * 1.3 + k * 2.1) * (3 + wind * 4);
    const x = f.x + sway, y = VIEW.H - 4;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = f.c;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 15, y - 8 + Math.sin(a) * 15, 11, 7, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.arc(x, y - 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // A soft dark foot to ground the frame.
  const foot = ctx.createLinearGradient(0, VIEW.H - 46, 0, VIEW.H);
  foot.addColorStop(0, 'rgba(0,40,0,0)');
  foot.addColorStop(1, 'rgba(0,40,0,0.22)');
  ctx.fillStyle = foot;
  ctx.fillRect(-24, VIEW.H - 46, VIEW.W + 48, 46);
}

// Soft vignette around the frame, plus a pulsing red edge when the
// bee is down to its last life.
export function drawVignette(ctx, world) {
  const g = ctx.createRadialGradient(
    VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.42,
    VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.95,
  );
  g.addColorStop(0, 'rgba(30,15,0,0)');
  g.addColorStop(1, 'rgba(30,15,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  if (world.phase === 'playing' && world.lives === 1) {
    const pulse = 0.08 + 0.05 * Math.sin(world.time * 6);
    const r = ctx.createRadialGradient(
      VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.45,
      VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.95,
    );
    r.addColorStop(0, 'rgba(200,0,0,0)');
    r.addColorStop(1, `rgba(200,0,0,${pulse.toFixed(3)})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }
}
