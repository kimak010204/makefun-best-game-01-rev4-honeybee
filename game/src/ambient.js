// HONEYBEE rev4 — ambient life.
// One job: everything that makes the meadow feel alive without touching
// the rules: butterflies, background bees, drifting petals and pollen,
// wind gusts, cloud shadows, a pond with dragonflies, and fireflies
// that wake up as the sunset deepens. All motion derives from
// world.time and the seeded rng, so a fixed seed replays exactly.
// The bee's squash-and-stretch and the flowers' nod live here too:
// tiny timers the game sets on lively moments, decayed every frame.

import { VIEW, GROUND_Y, HIVE } from './config.js';
import { clamp, range } from './rng.js';
import { petalBurst } from './particles.js';

export const POND = { x: 170, y: 672, rx: 95, ry: 20 };

export function createAmbient(world) {
  const rng = world.rng;
  const butterflies = [];
  const wingColors = ['#ff9f1c', '#ffffff', '#7fb5ff', '#c77dff'];
  for (let i = 0; i < 4; i++) {
    butterflies.push({
      cx: range(rng, 140, 1000), cy: range(rng, 170, 420),
      rx: range(rng, 50, 130), ry: range(rng, 22, 58),
      speed: range(rng, 0.14, 0.3), ph: range(rng, 0, Math.PI * 2),
      flap: range(rng, 6, 11), color: wingColors[i],
      size: range(rng, 7, 10),
    });
  }
  const drift = [];
  for (let i = 0; i < 16; i++) {
    drift.push({
      x: range(rng, 0, VIEW.W), y: range(rng, 90, GROUND_Y - 20),
      s: range(rng, 2, 4.5), ph: range(rng, 0, Math.PI * 2),
      petal: rng() < 0.35, color: rng() < 0.5 ? '#ffb3c7' : '#ffffff',
      fall: range(rng, 4, 12),
    });
  }
  const fireflies = [];
  for (let i = 0; i < 9; i++) {
    fireflies.push({
      x: range(rng, 80, 1180), y: range(rng, GROUND_Y + 20, 690),
      ph: range(rng, 0, Math.PI * 2), rate: range(rng, 1.2, 2.6),
      r: range(rng, 24, 70),
    });
  }
  const skyBees = [];
  for (let i = 0; i < 2; i++) {
    skyBees.push({
      cx: range(rng, 200, 1000), cy: range(rng, 90, 210),
      rx: range(rng, 120, 260), ry: range(rng, 18, 48),
      speed: range(rng, 0.1, 0.2), ph: range(rng, 0, Math.PI * 2),
    });
  }
  const hiveBees = [];
  for (let i = 0; i < 2; i++) {
    hiveBees.push({
      t: rng(), dir: 1, speed: range(rng, 0.1, 0.16),
      target: null, ph: range(rng, 0, Math.PI * 2),
    });
  }
  const dragonflies = [];
  for (let i = 0; i < 2; i++) {
    dragonflies.push({
      cx: POND.x + range(rng, -44, 44), cy: POND.y - range(rng, 34, 72),
      ph: range(rng, 0, Math.PI * 2), speed: range(rng, 1.6, 2.6),
    });
  }
  return { butterflies, drift, fireflies, skyBees, hiveBees, dragonflies };
}

// Wind strength 0..1: a slow breeze with a stronger gust rolling
// through every minute or so. Pure function of world.time.
export function windStrength(world) {
  const t = world.time;
  const base = 0.32 + 0.22 * Math.sin(t * 0.21 + 1.3);
  const gust = Math.pow(Math.max(0, Math.sin(t * 0.09 + 2.1)), 3) * 0.55;
  return clamp(base + gust, 0, 1);
}

// Day progress 0..1, mirroring the sky palette: morning to sunset.
export function dayProgressOf(world) {
  if (world.phase === 'title') return 0.12;
  if (world.phase === 'win') return 0.92;
  if (world.phase === 'lose') return 1;
  return clamp(1 - world.timeLeft / world.diff.time, 0, 1);
}

function pickFlowerTarget(world) {
  const blooming = world.flowers.filter((f) => f.pollen > 0);
  const pool = blooming.length ? blooming : world.flowers;
  return pool[Math.floor(world.rng() * pool.length)];
}

export function updateAmbient(world, input, dt) {
  const amb = world.ambient;
  if (!amb) return;
  const wind = windStrength(world);

  // Micro-animation timers decay.
  for (const f of world.flowers) {
    if (f.nod) f.nod = Math.max(0, f.nod - dt * 1.6);
  }
  if (world.bee.squash) world.bee.squash = Math.max(0, world.bee.squash - dt);

  // Clicking a bloom makes it nod and shed a few petals.
  if (input && input.clicked && world.phase === 'playing') {
    const { x, y } = input.clicked;
    let bestF = null, bestD = 70 * 70;
    for (const f of world.flowers) {
      if (f.pollen <= 0) continue;
      const dx = f.x - x, dy = (f.y - 18) - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestF = f; }
    }
    if (bestF) {
      bestF.nod = 1;
      petalBurst(world, bestF.x, bestF.y - 18);
    }
  }

  // Drifting petals and pollen ride the wind across the meadow.
  for (const m of amb.drift) {
    m.x += (6 + wind * 46) * dt;
    m.y += (m.fall * 0.4 + Math.sin(world.time * 0.8 + m.ph) * 5) * dt;
    if (m.x > VIEW.W + 12) {
      m.x = -12;
      m.y = range(world.rng, 90, GROUND_Y - 20);
    }
    if (m.y > GROUND_Y - 8) m.y = 90;
  }

  // Hive bees commute: out to a bloom, back to the hive, repeat.
  for (const hb of amb.hiveBees) {
    if (!hb.target) hb.target = pickFlowerTarget(world);
    hb.t += hb.dir * hb.speed * dt;
    if (hb.t >= 1) {
      hb.t = 1; hb.dir = -1;
    } else if (hb.t <= 0) {
      hb.t = 0; hb.dir = 1;
      hb.target = pickFlowerTarget(world);
    }
  }
}

// --- ground layer: cloud shadows, then the pond --------------------------

export function drawAmbientGround(ctx, world) {
  const amb = world.ambient;
  if (!amb) return;
  const t = world.time;
  // Soft shadows of the near cloud layer sliding over the grass.
  ctx.fillStyle = 'rgba(20,60,20,0.07)';
  for (let i = 0; i < 3; i++) {
    const x = ((i * 460 + t * 18 + 420) % (VIEW.W + 280)) - 140;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 92 + i * 26, 130, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The pond: a still blue mirror with slow ripples and lily pads.
  ctx.fillStyle = '#5aa8cf';
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8fd0e8';
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y - 2, POND.rx - 10, POND.ry - 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const r = ((t * 14 + i * 42) % 84) + 6;
    ctx.globalAlpha = Math.max(0, (1 - r / 90)) * 0.5;
    ctx.beginPath();
    ctx.ellipse(POND.x, POND.y, r, r * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Lily pads with one tiny pink bud.
  ctx.fillStyle = '#3f8f3a';
  ctx.beginPath();
  ctx.ellipse(POND.x - 42, POND.y + 6, 14, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(POND.x + 48, POND.y - 4, 11, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath();
  ctx.arc(POND.x - 42, POND.y + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // The sun's reflection shimmers on the water, warmer as the day ripens.
  const dayT = dayProgressOf(world);
  const reflA = 0.10 + dayT * 0.22;
  const rg = ctx.createLinearGradient(POND.x + 20, POND.y - 12, POND.x + 20, POND.y + 12);
  rg.addColorStop(0, `rgba(255,190,90,${reflA.toFixed(3)})`);
  rg.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.ellipse(POND.x + 20, POND.y, 34, 11, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- air layer: everything that flies, drifts or glows -------------------

function miniBee(ctx, x, y, scale, angle, time, ph) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const flap = Math.sin(time * 22 + ph) * 0.8;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(0, -9 - flap * 3, 8, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 2.6, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d1408';
  ctx.beginPath();
  ctx.arc(9, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawAmbientAir(ctx, world) {
  const amb = world.ambient;
  if (!amb) return;
  const t = world.time;
  const wind = windStrength(world);

  // Butterflies wander their own lazy loops.
  for (const b of amb.butterflies) {
    const x = b.cx + Math.cos(t * b.speed + b.ph) * b.rx;
    const y = b.cy + Math.sin(t * b.speed * 1.7 + b.ph) * b.ry;
    const flap = Math.sin(t * b.flap + b.ph);
    const dir = Math.sin(t * b.speed + b.ph + 0.6) >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(-b.size * 0.55, -flap * 3, b.size, b.size * 0.62, -0.5 - flap * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.size * 0.55, -flap * 3, b.size, b.size * 0.62, 0.5 + flap * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2b12';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2, b.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Background bees trace wide lazy loops high in the sky.
  for (const sb of amb.skyBees) {
    const x = sb.cx + Math.sin(t * sb.speed + sb.ph) * sb.rx;
    const y = sb.cy + Math.sin(t * sb.speed * 2.3 + sb.ph) * sb.ry;
    const angle = Math.cos(t * sb.speed + sb.ph) * 0.25;
    miniBee(ctx, x, y, 0.5, angle, t, sb.ph);
  }

  // Hive bees commute between the hive mouth and a bloom.
  for (const hb of amb.hiveBees) {
    const f = hb.target;
    if (!f) continue;
    const x0 = HIVE.x, y0 = HIVE.y + 22;
    const x2 = f.x, y2 = f.y - 30;
    const cx = (x0 + x2) / 2, cy = Math.min(y0, y2) - 90;
    const u = hb.t;
    const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x2;
    const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y2;
    const bob = Math.sin(t * 9 + hb.ph) * 2;
    const dx = 2 * (1 - u) * (cx - x0) + 2 * u * (x2 - cx);
    miniBee(ctx, x, y + bob, 0.55, clamp(dx * 0.004, -0.4, 0.4), t, hb.ph);
  }

  // Dragonflies dart and hover above the pond.
  for (const d of amb.dragonflies) {
    const x = d.cx + Math.sin(t * d.speed + d.ph) * 46;
    const y = d.cy + Math.cos(t * d.speed * 1.3 + d.ph) * 16;
    const wing = Math.sin(t * 30 + d.ph) * 0.9;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(-4, -4 - wing * 2, 10, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -4 + wing * 2, 10, 3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Drifting petals and pollen motes ride the wind.
  for (const m of amb.drift) {
    const sway = Math.sin(t * 0.8 + m.ph) * 3;
    if (m.petal) {
      ctx.save();
      ctx.translate(m.x, m.y + sway);
      ctx.rotate(t * 0.7 + m.ph);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.s, m.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.arc(m.x, m.y + sway, m.s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Fireflies wake as the sunset deepens.
  const dayT = dayProgressOf(world);
  if (dayT > 0.55) {
    const strength = (dayT - 0.55) / 0.45;
    for (const f of amb.fireflies) {
      const blink = 0.5 + 0.5 * Math.sin(t * f.rate + f.ph);
      const a = blink * strength * 0.9;
      if (a < 0.05) continue;
      const x = f.x + Math.sin(t * 0.5 + f.ph) * 18;
      const y = f.y + Math.cos(t * 0.37 + f.ph) * 12;
      const glow = ctx.createRadialGradient(x, y, 0.5, x, y, 10);
      glow.addColorStop(0, `rgba(190,255,120,${a.toFixed(3)})`);
      glow.addColorStop(1, 'rgba(190,255,120,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(230,255,150,${Math.min(1, a + 0.2).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A whisper of golden-hour warmth over the meadow at deep sunset.
  if (dayT > 0.75) {
    ctx.fillStyle = `rgba(255,110,40,${((dayT - 0.75) * 0.25).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }
}
