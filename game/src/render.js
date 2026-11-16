// HONEYBEE rev4 — every pixel the player sees.
// One job: draw the world. Sky that ripens into sunset, parallax clouds
// and hills, a layered meadow, the oak and its hive, the bee, the wasps,
// the queen, particles, popups, the HUD and every menu screen.

import { VIEW, GROUND_Y, HIVE, POUCH_MAX, HONEY_GOAL, FLOWERS, POWERUPS, SKY_KEYS, WASP_KINDS, DIFFICULTY } from './config.js';
import { clamp, lerp, hexLerp } from './rng.js';
import { windStrength, drawAmbientGround, drawAmbientAir } from './ambient.js';
import { drawGodRays, drawShowtimeFront, drawVignette, fadeAlpha, growthOf } from './showtime.js';

// Count-up easing for the end screens: 0..1 over the first 0.9s of the
// panel, so the stats tick up instead of appearing all at once.
export function countFrac(time) {
  const p = clamp(time / 0.9, 0, 1);
  return 1 - Math.pow(1 - p, 3);
}

export function countShown(final, time) {
  return Math.round(final * countFrac(time));
}

// Sun-dial angle: the little sun rides the dial from the top of the arc
// down to the right horizon as the day runs out.
export function sunDialAngle(left, total) {
  const frac = total > 0 ? clamp(left / total, 0, 1) : 0;
  return Math.PI * 1.5 + (1 - frac) * Math.PI * 0.5;
}

// Queen dive telegraph: a shrinking ring on the target, a red shadow
// pooling on the ground beneath it. Progress 0..1 across the aim.
export function diveTelegraph(q, time) {
  const prog = clamp(q.stateT / 1.15, 0, 1);
  return {
    ringR: 46 - 26 * prog + Math.sin(time * 14) * 2,
    shadowR: 30 + 16 * prog,
    shadowA: 0.10 + 0.16 * prog + 0.05 * Math.sin(time * 14),
  };
}

export function render(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * world.shake * 9;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  // The soft camera drifts the world a few pixels toward the bee;
  // the HUD is drawn un-translated so it never moves.
  if (world.cam) ctx.translate(-world.cam.x, -world.cam.y);
  drawSky(ctx, world);
  drawSun(ctx, world);
  drawGodRays(ctx, world);
  drawClouds(ctx, world);
  drawBirds(ctx, world);
  drawHills(ctx, world);
  drawMeadow(ctx, world);
  drawAmbientGround(ctx, world);
  drawWebs(ctx, world);
  drawFlowers(ctx, world);
  drawPowerups(ctx, world);
  drawTreeAndHive(ctx, world);
  drawAmbientAir(ctx, world);
  drawWasps(ctx, world);
  if (world.queen) drawQueen(ctx, world);
  drawBee(ctx, world);
  drawParticles(ctx, world);
  drawPopups(ctx, world);
  drawShowtimeFront(ctx, world);
  ctx.save();
  if (world.cam) ctx.translate(world.cam.x, world.cam.y);
  drawHud(ctx, world);
  ctx.restore();
  if (world.showtime && world.showtime.queenIntro > 0) {
    // Cinematic dim while the queen storms in.
    ctx.fillStyle = `rgba(24,4,40,${(0.22 * Math.min(1, world.showtime.queenIntro)).toFixed(3)})`;
    ctx.fillRect(-24, -24, VIEW.W + 48, VIEW.H + 48);
  }
  if (world.banner) drawBanner(ctx, world);
  if (world.phase === 'title') drawTitle(ctx, world);
  if (world.phase === 'paused') drawPaused(ctx, world);
  if (world.phase === 'win') drawEnd(ctx, world, true);
  if (world.phase === 'lose') drawEnd(ctx, world, false);
  ctx.restore();
  drawVignette(ctx, world);
  const fa = fadeAlpha(world);
  if (fa > 0) {
    ctx.fillStyle = `rgba(20,10,0,${fa.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${(world.flash * 0.22).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }
}

// --- sky, sun, clouds, hills ---------------------------------------------

function dayProgress(world) {
  if (world.phase === 'title') return 0.12;
  if (world.phase === 'win') return 0.92;
  if (world.phase === 'lose') return 1;
  const total = world.diff.time;
  return clamp(1 - world.timeLeft / total, 0, 1);
}

function skyAt(t) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = clamp((t - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
  return {
    top: hexLerp(a.top, b.top, f), mid: hexLerp(a.mid, b.mid, f),
    hor: hexLerp(a.hor, b.hor, f), sun: hexLerp(a.sun, b.sun, f),
    sunY: lerp(a.sunY, b.sunY, f),
  };
}

function drawSky(ctx, world) {
  const t = dayProgress(world);
  const sky = skyAt(t);
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 40);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.55, sky.mid);
  g.addColorStop(1, sky.hor);
  ctx.fillStyle = g;
  // Overscanned: the soft camera may shift the world a few pixels.
  ctx.fillRect(-24, -24, VIEW.W + 48, VIEW.H + 48);
  world._sky = sky;
}

function withAlpha(rgb, a) {
  const m = rgb.match(/\d+/g);
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}

function drawSun(ctx, world) {
  const sky = world._sky || skyAt(dayProgress(world));
  const t = dayProgress(world);
  const sx = lerp(180, 1060, t);
  const sy = sky.sunY * VIEW.H;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 150);
  glow.addColorStop(0, sky.sun);
  glow.addColorStop(0.35, withAlpha(sky.sun, 0.55));
  glow.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 160, sy - 160, 320, 320);
  ctx.fillStyle = sky.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 34 + t * 10, 0, Math.PI * 2);
  ctx.fill();
  // Sun rays, slowly turning.
  ctx.strokeStyle = sky.sun;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + world.time * 0.05;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 46, sy + Math.sin(a) * 46);
    ctx.lineTo(sx + Math.cos(a) * 62, sy + Math.sin(a) * 62);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function cloud(ctx, x, y, s, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 30 * s, y + 6 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 32 * s, y + 5 * s, 32 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, world) {
  const t = world.time;
  // Far layer: slow, faint. Near layer: faster, brighter.
  for (let i = 0; i < 4; i++) {
    const x = ((i * 340 + t * 9 + 90) % (VIEW.W + 240)) - 120;
    cloud(ctx, x, 84 + i * 26, 0.8 + (i % 2) * 0.25, 0.5);
  }
  for (let i = 0; i < 3; i++) {
    const x = ((i * 460 + t * 18 + 420) % (VIEW.W + 280)) - 140;
    cloud(ctx, x, 150 + i * 44, 1.15, 0.85);
  }
}

function drawBirds(ctx, world) {
  ctx.strokeStyle = 'rgba(60,50,80,0.7)';
  ctx.lineWidth = 2;
  for (const b of world.birds) {
    const flap = Math.sin(b.ph) * 5;
    ctx.beginPath();
    ctx.moveTo(b.x - 9, b.y);
    ctx.quadraticCurveTo(b.x - 3, b.y - 5 - flap, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 3, b.y - 5 - flap, b.x + 9, b.y);
    ctx.stroke();
  }
}

function drawHills(ctx, world) {
  // Far hills: dusty blue-green. Near hills: deep green.
  ctx.fillStyle = '#8fb8a0';
  ctx.beginPath();
  ctx.moveTo(-40, GROUND_Y);
  ctx.bezierCurveTo(180, GROUND_Y - 86, 320, GROUND_Y - 30, 520, GROUND_Y - 64);
  ctx.bezierCurveTo(720, GROUND_Y - 96, 900, GROUND_Y - 34, 1100, GROUND_Y - 70);
  ctx.bezierCurveTo(1200, GROUND_Y - 88, 1260, GROUND_Y - 60, 1320, GROUND_Y - 66);
  ctx.lineTo(1320, GROUND_Y + 20);
  ctx.lineTo(-40, GROUND_Y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6aa86a';
  ctx.beginPath();
  ctx.moveTo(-40, GROUND_Y + 6);
  ctx.bezierCurveTo(200, GROUND_Y - 34, 420, GROUND_Y - 8, 640, GROUND_Y - 30);
  ctx.bezierCurveTo(860, GROUND_Y - 50, 1060, GROUND_Y - 10, 1320, GROUND_Y - 26);
  ctx.lineTo(1320, GROUND_Y + 30);
  ctx.lineTo(-40, GROUND_Y + 30);
  ctx.closePath();
  ctx.fill();
}

function drawMeadow(ctx, world) {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW.H);
  g.addColorStop(0, '#7cc24a');
  g.addColorStop(0.5, '#5da83a');
  g.addColorStop(1, '#4a8f2f');
  ctx.fillStyle = g;
  ctx.fillRect(-24, GROUND_Y, VIEW.W + 48, VIEW.H - GROUND_Y + 24);
  // Dirt path from the meadow up to the hive tree.
  ctx.fillStyle = '#c9a86a';
  ctx.beginPath();
  ctx.moveTo(1020, VIEW.H);
  ctx.quadraticCurveTo(1080, GROUND_Y + 60, 1105, GROUND_Y + 8);
  ctx.quadraticCurveTo(1130, GROUND_Y + 60, 1180, VIEW.H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.ellipse(1060 + i * 14, GROUND_Y + 40 + i * 14, 7, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Swaying grass blades, leaning harder when a gust rolls through.
  const wind = windStrength(world);
  ctx.strokeStyle = 'rgba(30,90,20,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 130; i++) {
    const x = (i * 97.3) % VIEW.W;
    const y = GROUND_Y + 12 + ((i * 53.7) % 140);
    const sway = Math.sin(world.time * 1.6 + i) * (3 + wind * 5) + wind * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - 8, x + sway * 1.6, y - 13);
    ctx.stroke();
  }
  // Clover patches.
  ctx.fillStyle = 'rgba(40,110,40,0.5)';
  for (let i = 0; i < 10; i++) {
    const x = (i * 211.7) % VIEW.W;
    const y = GROUND_Y + 30 + ((i * 89.3) % 120);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + k * 6 - 6, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- flowers, webs, power-ups --------------------------------------------

function drawFlowers(ctx, world) {
  const wind = windStrength(world);
  for (const f of world.flowers) {
    const def = FLOWERS[f.kind];
    if (f.pollen <= 0) {
      // Regrowing stub: a small sprout, then a bud as it nears bloom.
      ctx.strokeStyle = '#3f7d2c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x, f.y - 14);
      ctx.stroke();
      const regrowFrac = 1 - f.regrow / FLOWERS[f.kind].respawn;
      if (regrowFrac > 0.55) {
        ctx.fillStyle = '#5da83a';
        ctx.beginPath();
        ctx.arc(f.x, f.y - 18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = def.petal;
        ctx.beginPath();
        ctx.arc(f.x, f.y - 20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    // Wind bends the stem; a fresh landing makes the bloom nod hard.
    const sway = Math.sin(world.time * 1.8 + f.sway) * (3 + wind * 4) + wind * 3 + (f.nod || 0) * 6;
    const topX = f.x + sway;
    const topY = f.y - def.stem;
    // Glow halo, pulsing; golden blooms blaze.
    const pulse = 0.75 + Math.sin(world.time * 2.4 + f.sparkle) * 0.25;
    const glowR = (f.kind === 'golden' ? 52 : 30) * pulse;
    const glow = ctx.createRadialGradient(topX, topY, 2, topX, topY, glowR);
    glow.addColorStop(0, def.petal + '55');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(topX, topY, glowR, 0, Math.PI * 2);
    ctx.fill();
    // Stem + leaves.
    ctx.strokeStyle = '#3f7d2c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x - sway * 0.5, f.y - def.stem * 0.6, topX, topY);
    ctx.stroke();
    ctx.fillStyle = '#4a9a3a';
    ctx.beginPath();
    ctx.ellipse(f.x - 8, f.y - def.stem * 0.45, 8, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // The bloom grows with its pollen: full blooms are whole,
    // half-picked ones are smaller and tighter.
    const g = growthOf(f);
    ctx.save();
    ctx.translate(topX, topY);
    ctx.scale(g, g);
    ctx.translate(-topX, -topY);
    drawBloom(ctx, f, def, topX, topY, world.time);
    ctx.restore();
    // Pollen dots left on the bloom.
    if (f.pollen < f.maxPollen) {
      ctx.fillStyle = 'rgba(90,60,10,0.8)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${f.pollen}/${f.maxPollen}`, topX, topY - 22);
    }
  }
}

function drawBloom(ctx, f, def, x, y, t) {
  if (f.kind === 'tulip') {
    ctx.fillStyle = def.petal;
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.quadraticCurveTo(x - 13, y - 20, x - 5, y - 16);
    ctx.quadraticCurveTo(x, y - 24, x + 5, y - 16);
    ctx.quadraticCurveTo(x + 13, y - 20, x + 11, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y - 14, 3, 0, Math.PI * 2);
    ctx.fill();
    // Petal seams.
    ctx.strokeStyle = 'rgba(120,20,60,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 16);
    ctx.quadraticCurveTo(x - 6, y - 6, x - 5, y);
    ctx.moveTo(x + 5, y - 16);
    ctx.quadraticCurveTo(x + 6, y - 6, x + 5, y);
    ctx.stroke();
  } else if (f.kind === 'lavender') {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#b79ced' : def.petal;
      ctx.beginPath();
      ctx.ellipse(x + (i - 2) * 3, y - 6 - i * 6, 5, 7, (i - 2) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y - 34, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === 'sunflower') {
    // A darker second ring behind the bright petals.
    ctx.fillStyle = '#e89b00';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 8, 4.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.petal;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 15, y + Math.sin(a) * 15, 9, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a0a';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(x + ((i * 37) % 14) - 7, y + ((i * 53) % 14) - 7, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.kind === 'golden') {
    ctx.fillStyle = def.petal;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + world_time_spin(f);
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 10, 4.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === 'clover') {
    // Trefoil: three round pink leaves, paler than a daisy.
    ctx.fillStyle = def.petal;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7 - 2, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Daisy: an outer ring of round petals and a smaller inner ring.
    ctx.fillStyle = '#f7f7f7';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.petal;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 7, 4.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.core;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dew: a tiny glint that twinkles on a petal tip, on its own clock.
  const dewPhase = Math.sin(t * 1.3 + f.sparkle * 9);
  if (dewPhase > 0.86) {
    const da = f.sparkle;
    const dx = x + Math.cos(da) * 12, dy = y + Math.sin(da) * 12 - 4;
    ctx.fillStyle = `rgba(255,255,255,${((dewPhase - 0.86) * 6).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(dx, dy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function world_time_spin(f) { return f.sparkle * 0.1; }

function drawWebs(ctx, world) {
  for (const w of world.webs) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * w.r, Math.sin(a) * w.r);
      ctx.stroke();
    }
    for (let r = 12; r < w.r; r += 11) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = r + Math.sin(a * 3 + w.rot) * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    ctx.restore();
    // The spider: a dark bead with legs, shifting at the web's edge.
    const sx = w.x + w.r * 0.55 + Math.sin(world.time * 2 + w.rot) * 3;
    const sy = w.y - w.r * 0.5 + Math.cos(world.time * 1.7 + w.rot) * 2;
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (i - 1.5) * 7, sy - 9);
      ctx.stroke();
    }
  }
}

function drawPowerups(ctx, world) {
  for (const p of world.powerups) {
    const def = POWERUPS[p.kind];
    const bob = Math.sin(world.time * 3 + p.bob) * 5;
    const blink = p.life < 3 ? (Math.sin(world.time * 12) > 0 ? 1 : 0.25) : 1;
    ctx.globalAlpha = blink;
    const glow = ctx.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, 34);
    glow.addColorStop(0, def.color + '88');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind === 'swift' ? '»' : p.kind === 'shield' ? '⬢' : '◎', p.x, p.y + bob + 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = def.color;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(def.label, p.x, p.y + bob + 30);
  }
}

// --- tree, hive, bee, wasps, queen ----------------------------------------

function drawTreeAndHive(ctx, world) {
  // Oak trunk with bark shading.
  const trunk = ctx.createLinearGradient(1060, 0, 1150, 0);
  trunk.addColorStop(0, '#6b4423');
  trunk.addColorStop(0.5, '#8a5a30');
  trunk.addColorStop(1, '#5d3a1e');
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(1078, GROUND_Y + 4);
  ctx.quadraticCurveTo(1086, 460, 1096, 330);
  ctx.lineTo(1128, 330);
  ctx.quadraticCurveTo(1136, 460, 1144, GROUND_Y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,8,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(1090 + i * 14, GROUND_Y);
    ctx.quadraticCurveTo(1092 + i * 14, 460, 1098 + i * 10, 350);
    ctx.stroke();
  }
  // Canopy: layered green puffs with sunlit tops.
  const puffs = [
    [1096, 250, 62, '#3f8f3a'], [1150, 230, 70, '#4da344'], [1108, 190, 58, '#5cb85a'],
    [1052, 268, 44, '#357a32'], [1192, 262, 46, '#357a32'], [1122, 150, 48, '#6cc46a'],
  ];
  // The canopy breathes: the whole crown sways a couple of pixels.
  const canopySway = Math.sin(world.time * 0.9) * 2;
  for (const [x, y, r, c] of puffs) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + canopySway, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(x + canopySway - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // A papery wasp nest hangs from a low branch at the canopy's edge.
  ctx.strokeStyle = '#5d3a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1062, 252);
  ctx.lineTo(1004, 214);
  ctx.stroke();
  let nestY = 216;
  for (const [w, c] of [[26, '#8a7d6b'], [22, '#7a6e5d'], [17, '#9a8d7a']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(1000, nestY, w, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    nestY += 11;
  }
  ctx.fillStyle = '#3a2c1c';
  ctx.beginPath();
  ctx.ellipse(1000, nestY - 2, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // The hive: a skep of honeycomb rings hanging from a branch.
  const hx = HIVE.x, hy = HIVE.y;
  const sway = Math.sin(world.time * 1.1) * 1.5;
  ctx.save();
  ctx.translate(sway, 0);
  ctx.strokeStyle = '#5d3a1e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hx, hy - 62);
  ctx.lineTo(hx, hy - 34);
  ctx.stroke();
  const rings = [
    [34, '#d99a2b'], [40, '#c98a1f'], [44, '#e8b23a'], [42, '#d99a2b'], [36, '#c98a1f'], [26, '#e8b23a'],
  ];
  let ry = hy - 34;
  for (const [w, c] of rings) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(hx, ry, w, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ry += 13;
  }
  ctx.fillStyle = '#3a2408';
  ctx.beginPath();
  ctx.ellipse(hx, hy + 22, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // The hive fills with the day: brighter gold, longer drips, and a
  // second drip once the jar overflows.
  const hf = clamp(world.honey / HONEY_GOAL, 0, 1);
  if (hf > 0) {
    const hg = ctx.createRadialGradient(hx, hy, 6, hx, hy, 78);
    hg.addColorStop(0, `rgba(255,200,40,${(0.12 + hf * 0.3).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, 78, 0, Math.PI * 2);
    ctx.fill();
  }
  // Honey drip.
  ctx.fillStyle = '#ffb400';
  ctx.beginPath();
  ctx.ellipse(hx + 12, hy + 34, 3, 5 + hf * 8 + Math.sin(world.time * 2) * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hf >= 1) {
    ctx.beginPath();
    ctx.ellipse(hx - 14, hy + 30, 2.5, 6 + Math.sin(world.time * 2.6) * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hex comb hint on the front ring.
  ctx.strokeStyle = 'rgba(90,50,5,0.45)';
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(hx + i * 12, hy - 8, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Hive glow when the bee is close with a full pouch.
  if (world.bee.pouch > 0) {
    const g = ctx.createRadialGradient(hx, hy, 10, hx, hy, 90);
    g.addColorStop(0, 'rgba(255,200,40,0.35)');
    g.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeeShape(ctx, x, y, angle, wing, scale, invuln, time, sy = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale * sy);
  if (invuln > 0 && Math.sin(time * 24) > 0) ctx.globalAlpha = 0.45;
  // Shadow on the ground far below is drawn by the caller; wings first.
  const flap = Math.sin(wing) * 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-2, -12 - flap * 4, 11, 5.5, -0.5 - flap * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -11 - flap * 3, 9, 4.5, 0.4 + flap * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Wing blur: a faint, wider echo of the wings sells the flutter.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-2, -13 - flap * 4, 13, 6.5, -0.5 - flap * 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Body: yellow with three black stripes.
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 3.5, 9.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-8, 0, 3, 8.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head + blinking eye with a glint + smile.
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath();
  ctx.arc(13, -2, 7, 0, Math.PI * 2);
  ctx.fill();
  const blink = (time % 3.4) < 0.12;
  if (blink) {
    ctx.strokeStyle = '#1d1408';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(12.5, -4);
    ctx.lineTo(17.5, -4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1d1408';
    ctx.beginPath();
    ctx.arc(15, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.8, -4.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1d1408';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(15, 1, 3, 0.2, Math.PI * 0.7);
  ctx.stroke();
  // Antennae.
  ctx.beginPath();
  ctx.moveTo(12, -8);
  ctx.quadraticCurveTo(14, -14, 18, -14);
  ctx.moveTo(9, -9);
  ctx.quadraticCurveTo(9, -15, 12, -16);
  ctx.stroke();
  // Stinger.
  ctx.fillStyle = '#1d1408';
  ctx.beginPath();
  ctx.moveTo(-14, -3);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-14, 3);
  ctx.closePath();
  ctx.fill();
  // Little dangling legs.
  ctx.strokeStyle = '#1d1408';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const lx = -4 + i * 5;
    ctx.beginPath();
    ctx.moveTo(lx, 8);
    ctx.lineTo(lx + 1.5, 13);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBee(ctx, world) {
  const bee = world.bee;
  // Ground shadow.
  const groundY = GROUND_Y + 132;
  const hFrac = clamp(1 - (groundY - bee.y) / 620, 0.15, 1);
  ctx.fillStyle = `rgba(0,0,0,${(0.18 * hFrac).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(bee.x, groundY, 16 * hFrac + 6, 5 * hFrac + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gentle hover bob, plus squash-and-stretch right after a landing.
  const bob = Math.sin(world.time * 3.2) * 1.5;
  const sq = bee.squash > 0 ? bee.squash / 0.18 : 0;
  // Bigger and bolder than before: the hero fills the frame.
  drawBeeShape(ctx, bee.x, bee.y + bob, bee.angle, bee.wing, 1.22 + sq * 0.12, bee.invuln, world.time, 1 - sq * 0.18);
  // Pouch: pollen dots carried under the bee.
  if (bee.pouch > 0) {
    ctx.fillStyle = '#ffd23d';
    for (let i = 0; i < bee.pouch; i++) {
      ctx.beginPath();
      ctx.arc(bee.x - 10 + i * 4.4, bee.y + 11 + Math.sin(world.time * 8 + i) * 1.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Shield bubble.
  if (bee.shield) {
    ctx.strokeStyle = 'rgba(76,201,240,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bee.x, bee.y, 26 + Math.sin(world.time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawWasp(ctx, x, y, r, wing, color, stripe, angle, time, queen = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const flap = Math.sin(wing) * 0.8;
  // The queen looms in a violet aura with broad, slow wings.
  if (queen) {
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 2.4);
    aura.addColorStop(0, 'rgba(150,60,220,0.35)');
    aura.addColorStop(1, 'rgba(150,60,220,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(220,220,220,0.6)';
  ctx.beginPath();
  ctx.ellipse(0, -r - 2 - flap * 3, r * (queen ? 1.05 : 0.7), r * (queen ? 0.42 : 0.24), -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Long, slim, segmented body — nothing like the round little bee.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, r * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, 0, r * 0.2, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.7, 0, r * 0.16, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Angry red eyes.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(r * 0.78, -r * 0.2, queen ? 3.4 : 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d1408';
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, -2);
  ctx.lineTo(-r * 1.05 - 8, 0);
  ctx.lineTo(-r * 1.05, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWasps(ctx, world) {
  for (const w of world.wasps) {
    const def = WASP_KINDS[w.kind];
    const angle = Math.atan2(w.vy, w.vx) * 0.3;
    // Ambusher flashes red just before its dash.
    const flashing = w.kind === 'ambusher' && w.stateT > 1.1 && w.stateT < 1.4 && Math.sin(world.time * 20) > 0;
    drawWasp(ctx, w.x, w.y, w.r, w.wing, flashing ? '#a11' : def.color, def.stripe, angle, world.time);
    if (w.kind === 'ambusher' && w.stateT > 1.1 && w.stateT < 1.4) {
      ctx.strokeStyle = 'rgba(255,60,60,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(world.bee.x, world.bee.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawQueen(ctx, world) {
  const q = world.queen;
  // Dive telegraph: a shrinking ring on the target and a red shadow
  // pooling on the ground beneath where she will land.
  if (q.state === 'aim') {
    const tel = diveTelegraph(q, world.time);
    ctx.fillStyle = `rgba(255,40,80,${clamp(tel.shadowA, 0, 0.3).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(q.targetX, GROUND_Y + 132, tel.shadowR, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,40,80,${(0.5 + Math.sin(world.time * 14) * 0.3).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(q.targetX, q.targetY, tel.ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.targetX - 34, q.targetY);
    ctx.lineTo(q.targetX + 34, q.targetY);
    ctx.moveTo(q.targetX, q.targetY - 34);
    ctx.lineTo(q.targetX, q.targetY + 34);
    ctx.stroke();
  }
  drawWasp(ctx, q.x, q.y, q.r, q.wing, '#4a1d5e', '#c77dff', Math.atan2(q.vy, q.vx) * 0.25, world.time, true);
  // Crown.
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(q.x - 10, q.y - q.r - 2);
  ctx.lineTo(q.x - 10, q.y - q.r - 12);
  ctx.lineTo(q.x - 5, q.y - q.r - 6);
  ctx.lineTo(q.x, q.y - q.r - 13);
  ctx.lineTo(q.x + 5, q.y - q.r - 6);
  ctx.lineTo(q.x + 10, q.y - q.r - 12);
  ctx.lineTo(q.x + 10, q.y - q.r - 2);
  ctx.closePath();
  ctx.fill();
}

// --- particles, popups, HUD ------------------------------------------------

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    } else if (p.shape === 'puff') {
      // Landing dust: a soft circle that grows as it fades.
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (p.t / p.life) * 2.4), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'petal') {
      // A fluttering petal, spinning as it rides the wind.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, world) {
  ctx.textAlign = 'center';
  for (const p of world.popups) {
    const a = p.t < 0.15 ? p.t / 0.15 : 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = p.big ? 'bold 22px sans-serif' : 'bold 15px sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function pill(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawHud(ctx, world) {
  if (world.phase === 'title') return;
  ctx.textBaseline = 'middle';

  // --- honey jar, top left -------------------------------------------------
  const jarX = 18, jarY = 16, jarW = 250, jarH = 58;
  pill(ctx, jarX, jarY, jarW, jarH, 'rgba(255,251,235,0.92)', '#b8860b');
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🍯 HONEY', jarX + 14, jarY + 15);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(world.honey)}%`, jarX + jarW - 14, jarY + 15);
  // Jar body with a wavy honey surface; it sloshes after a delivery.
  const fillW = 222;
  const frac = world.honey / HONEY_GOAL;
  const sloshAmp = world.showtime ? Math.max(0, world.showtime.slosh) * 8 : 0;
  ctx.fillStyle = '#e8d9b0';
  ctx.beginPath();
  ctx.roundRect(jarX + 14, jarY + 28, fillW, 18, 9);
  ctx.fill();
  if (frac > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(jarX + 14, jarY + 28, fillW, 18, 9);
    ctx.clip();
    ctx.fillStyle = frac >= 1 ? '#7ed957' : '#ffb400';
    const waveY = jarY + 28 + 18 - 18 * frac;
    ctx.beginPath();
    ctx.moveTo(jarX + 14, jarY + 46);
    ctx.lineTo(jarX + 14, waveY + Math.sin(world.time * 3) * (2 + sloshAmp));
    for (let x = 0; x <= fillW; x += 8) {
      ctx.lineTo(jarX + 14 + x, waveY + Math.sin(world.time * 3 + x * 0.08) * (2 + sloshAmp));
    }
    ctx.lineTo(jarX + 14 + fillW, jarY + 46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- hearts + pouch, next to the jar -------------------------------------
  const hpX = jarX + jarW + 12, hpY = jarY;
  pill(ctx, hpX, hpY, 150, 58, 'rgba(255,251,235,0.92)', '#b8860b');
  ctx.textAlign = 'left';
  for (let i = 0; i < 3; i++) {
    ctx.font = '18px sans-serif';
    ctx.fillText(i < world.lives ? '❤️' : '🤍', hpX + 12 + i * 28, hpY + 16);
  }
  // Pouch as six little hex cells.
  for (let i = 0; i < POUCH_MAX; i++) {
    const cx = hpX + 16 + i * 20, cy = hpY + 42;
    ctx.fillStyle = i < world.bee.pouch ? '#ffb400' : '#e8d9b0';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const px = cx + Math.cos(a) * 8, py = cy + Math.sin(a) * 8;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // --- score, bottom left --------------------------------------------------
  pill(ctx, 18, VIEW.H - 52, 190, 36, 'rgba(40,30,10,0.78)', null);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${world.score}`, 32, VIEW.H - 33);
  if (world.best > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`BEST ${world.best}`, 32, VIEW.H - 62);
  }

  // --- sunset timer, top right ---------------------------------------------
  const tx = VIEW.W - 218, ty = 16;
  pill(ctx, tx, ty, 200, 58, 'rgba(255,251,235,0.92)', '#b8860b');
  const total = world.diff.time;
  const left = Math.max(0, world.timeLeft);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  const urgent = left < 20 && world.phase === 'playing';
  ctx.fillStyle = urgent && Math.sin(world.time * 8) > 0 ? '#d90429' : '#7a4a12';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, tx + 186, ty + 22);
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('until sunset', tx + 186, ty + 46);
  // Sun dial: a little sun rides an arc down to the horizon as the day ends.
  const dialC = { x: tx + 26, y: ty + 29 };
  ctx.strokeStyle = '#e8d9b0';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(dialC.x, dialC.y, 17, Math.PI, Math.PI * 2);
  ctx.stroke();
  const sunA = sunDialAngle(left, total);
  ctx.strokeStyle = '#ff9e3d';
  ctx.beginPath();
  ctx.arc(dialC.x, dialC.y, 17, sunA, Math.PI * 2);
  ctx.stroke();
  const sunX = dialC.x + Math.cos(sunA) * 17;
  const sunY = dialC.y + Math.sin(sunA) * 17;
  ctx.fillStyle = '#ff9e3d';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff9e3d';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = sunA + (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sunX + Math.cos(a) * 8, sunY + Math.sin(a) * 8);
    ctx.lineTo(sunX + Math.cos(a) * 11, sunY + Math.sin(a) * 11);
    ctx.stroke();
  }

  // --- combo meter, top centre ---------------------------------------------
  if (world.combo >= 2 && world.phase === 'playing') {
    const cx = VIEW.W / 2;
    // The combo meter throbs as the streak climbs.
    const pulse = 1 + 0.05 * Math.sin(world.time * 10);
    ctx.save();
    ctx.translate(cx, 33);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -33);
    pill(ctx, cx - 90, 16, 180, 34, 'rgba(232,93,4,0.9)', '#fff');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🔥 COMBO x${world.combo}`, cx, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(cx - 78, 42, 156 * (world.comboTimer / 4), 4);
    ctx.restore();
  }

  // --- active power-up icons ------------------------------------------------
  let py = 88;
  const bee = world.bee;
  const effects = [];
  if (bee.swift > 0) effects.push(['» SWIFT', bee.swift, 8, '#ff9f1c']);
  if (bee.magnet > 0) effects.push(['◎ MAGNET', bee.magnet, 6, '#b388ff']);
  if (bee.shield) effects.push(['⬢ SHIELD', 1, 1, '#4cc9f0']);
  for (const [label, leftT, maxT, color] of effects) {
    pill(ctx, 18, py, 132, 26, 'rgba(255,255,255,0.9)', color);
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 28, py + 14);
    if (maxT > 1) {
      ctx.fillStyle = color;
      ctx.fillRect(28, py + 20, 112 * (leftT / maxT), 3);
    }
    py += 32;
  }

  // --- queen HP bar ----------------------------------------------------------
  if (world.queen) {
    const q = world.queen;
    const bw = 260, bx = VIEW.W / 2 - bw / 2, by = 58;
    pill(ctx, bx - 8, by - 8, bw + 16, 40, 'rgba(40,10,50,0.8)', '#c77dff');
    // A dodged dive lands: the bar throbs red while her flash lasts.
    if (q.flash > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(255,46,99,${(0.85 * q.flash).toFixed(3)})`;
      ctx.shadowBlur = 18 * q.flash;
      pill(ctx, bx - 8, by - 8, bw + 16, 40, 'rgba(40,10,50,0)', '#ff2e63');
      ctx.restore();
    }
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑 HORNET QUEEN', VIEW.W / 2, by + 4);
    for (let i = 0; i < world.diff.queenDives; i++) {
      ctx.fillStyle = i < q.divesLeft ? '#ff2e63' : '#4a2b5e';
      ctx.beginPath();
      ctx.roundRect(bx + i * (bw / world.diff.queenDives) + 2, by + 14, bw / world.diff.queenDives - 4, 10, 5);
      ctx.fill();
    }
  }

  // --- controls hint, bottom right -------------------------------------------
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD / arrows fly • mouse drag steers • M mute • P pause • R restart', VIEW.W - 16, VIEW.H - 14);
}

function drawBanner(ctx, world) {
  const b = world.banner;
  const a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.4 ? Math.max(0, (b.dur - b.t) / 0.4) : 1;
  ctx.globalAlpha = clamp(a, 0, 1);
  // The queen's entrance zooms: the banner throbs while the screen dims.
  const zoom = world.showtime && world.showtime.queenIntro > 0
    ? 1 + 0.07 * Math.sin(world.time * 12) : 1;
  ctx.save();
  ctx.translate(VIEW.W / 2, 159);
  ctx.scale(zoom, zoom);
  ctx.translate(-VIEW.W / 2, -159);
  const w = 620, x = VIEW.W / 2 - w / 2, y = 128;
  pill(ctx, x, y, w, 62, 'rgba(40,25,5,0.85)', b.color);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.text, VIEW.W / 2, y + 26);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '14px sans-serif';
  ctx.fillText(b.sub, VIEW.W / 2, y + 48);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// --- screens -----------------------------------------------------------------

function panel(ctx, x, y, w, h, border) {
  ctx.fillStyle = 'rgba(255,251,235,0.96)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawTitle(ctx, world) {
  // A soft veil so the meadow glows behind the panel.
  ctx.fillStyle = 'rgba(255,244,200,0.25)';
  ctx.fillRect(-24, -24, VIEW.W + 48, VIEW.H + 48);
  // A demo bee loops across the title meadow.
  const dx = ((world.time * 90) % (VIEW.W + 200)) - 100;
  const dy = 300 + Math.sin(world.time * 2.2) * 40;
  drawBeeShape(ctx, dx, dy, 0.1, world.time * 20, 1.15, 0, world.time);

  const px = 330, py = 118, pw = 620, ph = 470;
  panel(ctx, px, py, pw, ph, '#f4a900');
  // A little bee perches on the panel's top edge, bobbing gently.
  drawBeeShape(ctx, 640 + Math.sin(world.time * 1.1) * 20, py + 4 + Math.sin(world.time * 2.3) * 3, 0.05, world.time * 20, 0.9, 0, world.time);
  ctx.textAlign = 'center';
  // The title breathes: a gentle pulse, with pollen sparkles orbiting it.
  const titlePulse = 1 + 0.015 * Math.sin(world.time * 2);
  ctx.save();
  ctx.translate(640, py + 78);
  ctx.scale(titlePulse, titlePulse);
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('🐝 HONEYBEE', 0, 0);
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    const a = world.time * 0.7 + i * (Math.PI * 2 / 6);
    const sx = 640 + Math.cos(a) * 300;
    const sy = py + 70 + Math.sin(a) * 42;
    const tw = 0.5 + 0.5 * Math.sin(world.time * 3 + i * 1.7);
    ctx.globalAlpha = 0.35 + 0.45 * tw;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(sx, sy, 3 + tw, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#b8860b';
  ctx.font = 'italic bold 19px sans-serif';
  ctx.fillText('Fill the hive before sunset', 640, py + 112);
  ctx.fillStyle = '#5a3a0a';
  ctx.font = '16px sans-serif';
  const lines = [
    'Visit flowers to gather pollen — your pouch holds 6,',
    'and the heavier it gets, the slower you fly.',
    'Carry it home to the hive to fill the honey jar to 100%.',
    'Beware wasps and spiders — three stings and you fall!',
    'At 75% honey the Hornet Queen storms in…',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 640, py + 152 + i * 24));
  // Flower legend: every bloom, its worth.
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#7a4a12';
  ctx.fillText('THE MEADOW', 640, py + 296);
  const legend = [
    ['🌼 Daisy · 1', '#fff'], ['🌷 Tulip · 2', '#ff5d8f'], ['💜 Lavender · 2', '#9b7ede'],
    ['🌻 Sunflower · 3', '#ffb400'], ['⭐ Golden Bloom · 5', '#ffd700'],
  ];
  ctx.font = '14px sans-serif';
  legend.forEach(([t], i) => {
    ctx.fillStyle = '#5a3a0a';
    ctx.fillText(t, 430 + (i % 3) * 210, py + 324 + Math.floor(i / 3) * 24);
  });
  // Difficulty buttons, each with a tiny preview of its danger.
  const btns = [
    { key: 'easy', label: '1 · EASY', sub: '150s · gentle', wasps: 1, x: px + 40 },
    { key: 'normal', label: '2 · NORMAL', sub: '120s · lively', wasps: 2, x: px + 230 },
    { key: 'hard', label: '3 · HARD', sub: '95s · fierce 👑', wasps: 3, x: px + 420 },
  ];
  world._titleButtons = [];
  btns.forEach((b) => {
    const sel = world.difficultyKey === b.key;
    ctx.fillStyle = sel ? '#f4a900' : '#fff';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(b.x, py + 366, 160, 62, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = sel ? '#fff' : '#7a4a12';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(b.label, b.x + 80, py + 388);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = sel ? 'rgba(255,255,255,0.9)' : '#a08050';
    ctx.fillText(b.sub, b.x + 80, py + 406);
    // One tiny wasp per threat level; hard's are angry red.
    const totalW = b.wasps * 18;
    for (let i = 0; i < b.wasps; i++) {
      const wx = b.x + 80 - totalW / 2 + 9 + i * 18;
      const wy = py + 420;
      ctx.fillStyle = b.key === 'hard' ? '#7a1010' : '#3a2b12';
      ctx.beginPath();
      ctx.ellipse(wx, wy, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f7b500';
      ctx.beginPath();
      ctx.ellipse(wx - 1, wy, 1.8, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(wx, wy - 5, 4, 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    world._titleButtons.push({ key: b.key, x: b.x, y: py + 366, w: 160, h: 62 });
  });
  ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(world.time * 3));
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press SPACE or click a difficulty to start', 640, py + 452);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`🏆 Best score: ${world.best}`, 640, py + 476 - 14);
  }
}

function drawPaused(ctx, world) {
  ctx.fillStyle = 'rgba(30,20,5,0.45)';
  ctx.fillRect(-24, -24, VIEW.W + 48, VIEW.H + 48);
  panel(ctx, 440, 250, 400, 180, '#b8860b');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('⏸ PAUSED', 640, 320);
  ctx.fillStyle = '#5a3a0a';
  ctx.font = '16px sans-serif';
  ctx.fillText('P to resume • R to restart • M to mute', 640, 360);
  ctx.fillText(`Score ${world.score} • Honey ${Math.floor(world.honey)}%`, 640, 392);
}

function drawEnd(ctx, world, won) {
  const s = world.stats;
  // Sunset wash over the meadow on a loss; golden glow on a win.
  ctx.fillStyle = won ? 'rgba(255,210,60,0.18)' : 'rgba(120,40,90,0.35)';
  ctx.fillRect(-24, -24, VIEW.W + 48, VIEW.H + 48);
  const px = 380, py = 150, pw = 520, ph = 400;
  panel(ctx, px, py, pw, ph, won ? '#7ed957' : '#e85d75');
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#2f7d32' : '#a4133c';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(won ? '🎉 HIVE FULL!' : '🌇 SUNSET…', 640, py + 70);
  ctx.fillStyle = '#5a3a0a';
  ctx.font = '17px sans-serif';
  ctx.fillText(s.reason, 640, py + 108);
  // Stats rows: the numbers tick up over the first 0.9s of the panel.
  const rows = [
    ['Score', String(countShown(s.score, world.time))],
    ['Honey delivered', `${Math.floor(s.honey * countFrac(world.time))}%  (${countShown(s.delivered, world.time)} pollen)`],
    ['Best combo', `x${Math.max(1, countShown(s.bestCombo, world.time))}`],
    ...(won ? [['Time bonus', `+${countShown(s.timeBonus, world.time)}  (${s.timeLeft}s to spare)`]] : []),
    ...(s.queenBeaten ? [['Hornet Queen', 'driven off 👑']] : []),
    ['Best score', String(countShown(world.best, world.time))],
  ];
  ctx.font = '16px sans-serif';
  rows.forEach(([k, v], i) => {
    const y = py + 152 + i * 30;
    ctx.fillStyle = '#7a4a12';
    ctx.textAlign = 'left';
    ctx.fillText(k, px + 60, y);
    ctx.fillStyle = '#3a2408';
    ctx.textAlign = 'right';
    ctx.fillText(v, px + pw - 60, y);
  });
  ctx.fillStyle = '#7a4a12';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press R or SPACE to play again', 640, py + ph - 28);
}

export { skyAt, dayProgress };
