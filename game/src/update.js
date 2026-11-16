// HONEYBEE rev4 — simulation step.
// One job: advance the world one frame. Movement, collecting, delivering,
// wasp and queen behaviour, webs, power-ups, combo, timer, win and lose.
// Pure logic: it never draws and never touches the DOM.

import { VIEW, GROUND_Y, HIVE, POUCH_MAX, HONEY_GOAL, FLOWERS, POWERUPS, COMBO_WINDOW, COMBO_MAX } from './config.js';
import { clamp, dist2, range } from './rng.js';
import { spawnPowerup, spawnQueen, addPopup, burst, confetti, restockWasps, flowerAt, createWorld } from './world.js';
import { updateAmbient } from './ambient.js';
import { updateCamera } from './camera.js';
import { dustPuff, honeySplash, firework } from './particles.js';

const BEE_BASE_SPEED = 265;
const BEE_ACCEL = 1700;
const BEE_DAMP = 3.6;

export function update(world, input, dt, sfx) {
  // Cinematic time: a sting freezes the action for a beat, then the
  // world runs in slow motion while the bee recovers. The queen's
  // entrance and the honey slosh decay on the same clock.
  const st = world.showtime;
  if (st) {
    if (st.hitStop > 0) { st.hitStop -= dt; dt *= 0.12; }
    else if (st.slowmo > 0) { st.slowmo -= dt; dt *= 0.45; }
    if (st.queenIntro > 0) st.queenIntro -= dt;
    if (st.slosh > 0) st.slosh -= dt;
  }
  world.time += dt;
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t > world.banner.dur) world.banner = null;
  }
  world.shake = Math.max(0, world.shake - dt * 2.4);
  world.flash = Math.max(0, world.flash - dt * 2.0);
  updateParticles(world, dt);
  updatePopups(world, dt);
  updateBirds(world, dt);
  updateAmbient(world, input, dt);
  updateCamera(world, dt);

  if (world.phase === 'playing') updatePlaying(world, input, dt, sfx);
  else if (world.phase === 'win' || world.phase === 'lose') {
    // Confetti keeps falling on the win screen; the bee idles home.
    if (world.phase === 'win' && world.particles.length < 60 && world.rng() < 0.3) confetti(world, 3);
    // Fireworks pop over the meadow while the hive celebrates.
    // A shot world counts down its one deterministic burst (set by
    // buildShotWorld) so it is still bright when the shot is captured.
    if (world.phase === 'win' && world.shotBurstIn > 0) {
      world.shotBurstIn -= 1;
      if (world.shotBurstIn === 0) firework(world, 200, 170);
    }
    if (world.phase === 'win' && world.rng() < dt * 0.9) {
      firework(world, range(world.rng, 200, 1080), range(world.rng, 110, 300));
    }
  }
}

function updatePlaying(world, input, dt, sfx) {
  const bee = world.bee;
  world.timeLeft -= dt;
  if (world.timeLeft <= 0) { world.timeLeft = 0; return endGame(world, false, 'The sun set before the hive was full.', sfx); }

  // --- combo clock -------------------------------------------------------
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // --- bee steering: keys, or follow the mouse when it was used last ----
  let ax = input.ax, ay = input.ay;
  if (ax === 0 && ay === 0 && input.mouseMoved && input.mouseDown) {
    const dx = input.mouseX - bee.x, dy = input.mouseY - bee.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      ax = dx / d; ay = dy / d;
      // Ease into the pointer: full pull far away, gentle near it.
      const prox = clamp(d / 90, 0.25, 1);
      ax *= prox; ay *= prox;
    }
  } else if (ax !== 0 && ay !== 0) {
    // Diagonals get the same pull as cardinals.
    const inv = 1 / Math.hypot(ax, ay);
    ax *= inv; ay *= inv;
  }
  const load = bee.pouch / POUCH_MAX; // a full pouch is heavy
  // Quadratic load curve: light while the pouch is half full, truly
  // heavy only at the top — same endpoints as before (265 empty, 180 full).
  let maxSpeed = BEE_BASE_SPEED - 85 * load * load;
  if (bee.swift > 0) { maxSpeed *= 1.45; bee.swift -= dt; }
  if (bee.slow > 0) { maxSpeed *= 0.45; bee.slow -= dt; }
  if (bee.magnet > 0) bee.magnet -= dt;
  if (bee.invuln > 0) bee.invuln -= dt;

  bee.vx += ax * BEE_ACCEL * dt;
  bee.vy += ay * BEE_ACCEL * dt;
  const damp = Math.exp(-BEE_DAMP * dt);
  bee.vx *= damp; bee.vy *= damp;
  const spd = Math.hypot(bee.vx, bee.vy);
  if (spd > maxSpeed) { bee.vx *= maxSpeed / spd; bee.vy *= maxSpeed / spd; }
  bee.x = clamp(bee.x + bee.vx * dt, 24, VIEW.W - 24);
  bee.y = clamp(bee.y + bee.vy * dt, 60, GROUND_Y + 130);
  if (spd > 20) bee.angle = clamp(bee.vx / 240, -0.55, 0.55);
  bee.wing += dt * (14 + spd / 22);
  if (sfx) sfx.setBuzz(clamp(spd / 320, 0.15, 1));

  // Pollen trail behind a laden bee.
  if (bee.pouch > 0 && world.rng() < dt * 14) {
    world.particles.push({
      x: bee.x - Math.cos(bee.angle) * 14, y: bee.y + 8,
      vx: range(world.rng, -12, 12), vy: range(world.rng, 6, 26),
      t: 0, life: 0.55, size: range(world.rng, 1.5, 3), color: '#ffd23d',
      grav: 30, shape: 'dot',
    });
  }

  // --- flowers: collect, magnet, regrow ---------------------------------
  for (const f of world.flowers) {
    if (f.pollen <= 0) {
      f.regrow -= dt;
      if (f.regrow <= 0) { f.pollen = f.maxPollen; }
      continue;
    }
    const reach = bee.magnet > 0 ? 170 : 34;
    const d2 = dist2(bee.x, bee.y, f.x, f.y - 18);
    if (d2 < reach * reach && bee.pouch < POUCH_MAX) {
      const take = Math.min(f.pollen, POUCH_MAX - bee.pouch);
      f.pollen -= take;
      bee.pouch += take;
      world.collected += take;
      bumpCombo(world);
      const gain = 10 * take * world.combo;
      world.score += gain;
      addPopup(world, f.x, f.y - 46, `+${gain}`, '#7a4a12');
      burst(world, f.x, f.y - 18, '#ffd23d', 8, 90);
      f.nod = 1; // the bloom dips under the bee's weight
      bee.squash = 0.18; // squash-and-stretch on touchdown
      dustPuff(world, f.x, f.y - 4);
      if (sfx) sfx.collect(world.combo);
      if (f.pollen <= 0) f.regrow = FLOWERS[f.kind].respawn;
      if (f.kind === 'golden') {
        world.score += 50;
        addPopup(world, f.x, f.y - 70, 'GOLDEN +50!', '#b8860b', true);
      }
    }
  }

  // --- deliver at the hive ----------------------------------------------
  const hd2 = dist2(bee.x, bee.y, HIVE.x, HIVE.y);
  if (hd2 < (HIVE.r + 26) * (HIVE.r + 26) && bee.pouch > 0) {
    const n = bee.pouch;
    bee.pouch = 0;
    world.honey = Math.min(HONEY_GOAL, world.honey + n);
    world.delivered += n;
    const gain = 15 * n * Math.max(1, world.combo);
    world.score += gain;
    addPopup(world, HIVE.x - 30, HIVE.y - 70, `HONEY +${n}  (+${gain})`, '#b8860b', true);
    burst(world, HIVE.x, HIVE.y + 10, '#ffb400', 14, 130);
    honeySplash(world, HIVE.x, HIVE.y + 10);
    if (world.showtime) world.showtime.slosh = 0.7; // the jar wobbles
    if (sfx) sfx.deliver(n);
    if (world.honey >= 75 && !world.queenSpawned) spawnQueen(world);
    if (world.honey >= HONEY_GOAL) {
      return endGame(world, true, 'The hive overflows with honey.', sfx);
    }
  }

  // --- webs: sticky slow -------------------------------------------------
  for (const w of world.webs) {
    w.age += dt;
    if (dist2(bee.x, bee.y, w.x, w.y) < w.r * w.r && bee.slow <= 0) {
      bee.slow = 1.6;
      addPopup(world, bee.x, bee.y - 30, 'STUCK IN A WEB!', '#8d99ae');
      burst(world, bee.x, bee.y, '#e5e5e5', 6, 60);
    }
  }

  // --- power-ups ---------------------------------------------------------
  world.powerupTimer -= dt;
  if (world.powerupTimer <= 0) {
    spawnPowerup(world);
    world.powerupTimer = world.diff.powerupEvery;
  }
  for (let i = world.powerups.length - 1; i >= 0; i--) {
    const p = world.powerups[i];
    p.t += dt; p.life -= dt;
    if (p.life <= 0) { world.powerups.splice(i, 1); continue; }
    if (dist2(bee.x, bee.y, p.x, p.y) < 34 * 34) {
      applyPowerup(world, p, sfx);
      world.powerups.splice(i, 1);
    }
  }

  // --- wasps -------------------------------------------------------------
  world.waspTimer -= dt;
  if (world.waspTimer <= 0) { restockWasps(world); world.waspTimer = 3.5; }
  for (let i = world.wasps.length - 1; i >= 0; i--) {
    const w = world.wasps[i];
    updateWasp(world, w, dt);
    if (w.x < -90 || w.x > VIEW.W + 90 || w.y < -60 || w.y > VIEW.H + 90) {
      world.wasps.splice(i, 1);
      continue;
    }
    if (bee.invuln <= 0 && dist2(bee.x, bee.y, w.x, w.y) < (w.r + 13) * (w.r + 13)) {
      stingBee(world, w.x, w.y, sfx);
      world.wasps.splice(i, 1);
      if (world.phase !== 'playing') return;
    }
  }

  // --- the Hornet Queen --------------------------------------------------
  if (world.queen) updateQueen(world, dt, sfx);
}

function bumpCombo(world) {
  world.combo = Math.min(COMBO_MAX, world.combo + 1);
  world.comboTimer = COMBO_WINDOW;
  if (world.combo > world.bestCombo) world.bestCombo = world.combo;
  if (world.combo >= 3) {
    addPopup(world, world.bee.x, world.bee.y - 34, `COMBO x${world.combo}!`, '#e85d04', true);
  }
}

function applyPowerup(world, p, sfx) {
  const bee = world.bee;
  const def = POWERUPS[p.kind];
  if (p.kind === 'swift') bee.swift = def.secs;
  if (p.kind === 'shield') bee.shield = true;
  if (p.kind === 'magnet') bee.magnet = def.secs;
  addPopup(world, bee.x, bee.y - 34, def.text, def.color, true);
  burst(world, bee.x, bee.y, def.color, 12, 120);
  if (sfx) sfx.powerup();
}

function stingBee(world, sx, sy, sfx) {
  const bee = world.bee;
  if (bee.shield) {
    bee.shield = false;
    bee.invuln = 1.2;
    addPopup(world, bee.x, bee.y - 34, 'SHIELD SAVED YOU!', '#4cc9f0', true);
    burst(world, bee.x, bee.y, '#4cc9f0', 16, 150);
    return;
  }
  world.lives -= 1;
  world.combo = 0;
  world.comboTimer = 0;
  bee.invuln = 1.6;
  bee.vx = (bee.x - sx) * 2.4;
  bee.vy = (bee.y - sy) * 2.4 - 60;
  bee.pouch = Math.max(0, bee.pouch - 2); // stung bees drop pollen
  world.shake = 1;
  world.flash = 0.85;
  if (world.showtime) { world.showtime.hitStop = 0.12; world.showtime.slowmo = 0.45; }
  burst(world, bee.x, bee.y, '#ff4d4d', 18, 170);
  if (sfx) sfx.sting();
  if (world.lives <= 0) {
    endGame(world, false, 'Three stings — the little bee falls.', sfx);
  }
}

function updateWasp(world, w, dt) {
  const bee = world.bee;
  w.stateT += dt;
  w.wing += dt * 30;
  if (w.state === 'enter') {
    const tx = w.kind === 'chaser' ? bee.x : (w.x < 0 ? 220 : VIEW.W - 220);
    const ty = w.kind === 'chaser' ? bee.y : w.y;
    w.x += (tx - w.x) * dt * 0.8;
    w.y += (ty - w.y) * dt * 0.8;
    if (w.stateT > 1.6) { w.state = 'hunt'; w.stateT = 0; }
    return;
  }
  if (w.kind === 'chaser') {
    const dx = bee.x - w.x, dy = bee.y - w.y;
    const d = Math.hypot(dx, dy) || 1;
    w.vx += (dx / d) * w.speed * 2.2 * dt;
    w.vy += (dy / d) * w.speed * 2.2 * dt;
  } else if (w.kind === 'patroller') {
    w.vx = Math.cos(w.ph + w.stateT * 1.4) * w.speed;
    w.vy = Math.sin(w.stateT * 2.1) * w.speed * 0.55 + 20;
  } else { // ambusher: hover, then dash when the bee comes close
    if (w.stateT < 1.4) {
      w.vx *= 0.94; w.vy = Math.sin(w.stateT * 6) * 24;
    } else if (w.stateT < 1.7) {
      const dx = bee.x - w.x, dy = bee.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      w.dashX = dx / d; w.dashY = dy / d;
      w.vx = w.dashX * w.speed * 2.6;
      w.vy = w.dashY * w.speed * 2.6;
    } else if (w.stateT > 2.6) {
      w.stateT = 0;
    }
  }
  const damp = Math.exp(-1.6 * dt);
  w.vx *= damp; w.vy *= damp;
  const sp = Math.hypot(w.vx, w.vy);
  const cap = w.speed * (w.kind === 'ambusher' && w.stateT > 1.4 && w.stateT < 1.7 ? 2.6 : 1.35);
  if (sp > cap) { w.vx *= cap / sp; w.vy *= cap / sp; }
  w.x += w.vx * dt;
  w.y += w.vy * dt;
}

function updateQueen(world, dt, sfx) {
  const q = world.queen;
  const bee = world.bee;
  q.stateT += dt;
  q.wing += dt * 26;
  q.flash = Math.max(0, q.flash - dt * 3);
  const hoverY = 120;

  if (q.state === 'enter') {
    q.x += (VIEW.W - 260 - q.x) * dt * 1.4;
    q.y += (hoverY - q.y) * dt * 1.4;
    if (q.stateT > 1.8) { q.state = 'aim'; q.stateT = 0; if (sfx) sfx.queen(); }
    return;
  }
  if (q.state === 'aim') {
    // Telegraphed hover above the bee, then the dive.
    q.x += (bee.x - q.x) * dt * 2.2;
    q.y += (hoverY - q.y) * dt * 2.2;
    q.targetX = bee.x; q.targetY = bee.y;
    if (q.stateT > 1.15) { q.state = 'dive'; q.stateT = 0; }
    return;
  }
  if (q.state === 'dive') {
    const dx = q.targetX - q.x, dy = q.targetY - q.y;
    const d = Math.hypot(dx, dy) || 1;
    q.vx = (dx / d) * 620;
    q.vy = (dy / d) * 620;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (bee.invuln <= 0 && dist2(bee.x, bee.y, q.x, q.y) < (q.r + 14) * (q.r + 14)) {
      stingBee(world, q.x, q.y, sfx);
      q.divesLeft -= 1;
      q.state = 'recover'; q.stateT = 0;
      if (world.phase !== 'playing') return;
    } else if (q.y > GROUND_Y + 60 || q.stateT > 1.1) {
      q.divesLeft -= 1;
      q.flash = 1; // the dodge lands: her HP bar throbs
      world.score += 25;
      addPopup(world, q.x, q.y - 40, 'DODGED! +25', '#7b2d8b', true);
      q.state = 'recover'; q.stateT = 0;
    }
    return;
  }
  if (q.state === 'recover') {
    q.x += (VIEW.W - 200 - q.x) * dt * 1.2;
    q.y += (hoverY - q.y) * dt * 1.2;
    if (q.stateT > 1.6) {
      if (q.divesLeft <= 0) {
        // She retreats — and drops a golden bloom in defeat.
        world.queenBeaten = true;
        const f = { kind: 'golden', x: clamp(q.x - 120, 120, 1000), y: GROUND_Y + 70,
                    pollen: 5, maxPollen: 5, regrow: 0, sway: 0, sparkle: 0 };
        world.flowers.push(f);
        addPopup(world, q.x, q.y - 50, 'QUEEN RETREATS!', '#7b2d8b', true);
        burst(world, q.x, q.y, '#b388ff', 24, 200);
        world.queen = null;
        world.banner = { text: '👑 QUEEN DRIVEN OFF!', sub: 'A Golden Bloom sprouted where she fled', t: 0, dur: 2.6, color: '#7b2d8b' };
      } else {
        q.state = 'aim'; q.stateT = 0;
        // Each dive summons a wasp to the fight.
        world.wasps.push({
          kind: 'chaser', x: q.x, y: q.y + 30, vx: 0, vy: 0, r: 15,
          speed: world.diff.waspSpeed, ph: 0, state: 'hunt', stateT: 0,
          dashX: 0, dashY: 0, wing: 0,
        });
      }
    }
  }
}

function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.t += dt;
    if (p.t > p.life) { world.particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.rot !== undefined) p.rot += dt * 3;
  }
}

function updatePopups(world, dt) {
  for (let i = world.popups.length - 1; i >= 0; i--) {
    const p = world.popups[i];
    p.t += dt;
    p.y -= 34 * dt;
    if (p.t > p.life) world.popups.splice(i, 1);
  }
}

function updateBirds(world, dt) {
  for (const b of world.birds) {
    b.x += b.v * dt;
    b.ph += dt * 6;
    if (b.x > VIEW.W + 60) { b.x = -60; b.y = range(world.rng, 60, 200); }
  }
}

export function endGame(world, won, reason, sfx) {
  world.phase = won ? 'win' : 'lose';
  world.time = 0;
  let bonus = 0;
  if (won) {
    bonus = Math.round(world.timeLeft) * 5;
    world.score += bonus;
  }
  world.stats = {
    won, reason, score: world.score, honey: world.honey,
    delivered: world.delivered, collected: world.collected,
    bestCombo: world.bestCombo, timeBonus: bonus,
    timeLeft: Math.max(0, Math.round(world.timeLeft)),
    queenBeaten: world.queenBeaten,
  };
  if (world.score > world.best) {
    world.best = world.score;
    try { localStorage.setItem('honeybee-best', String(world.best)); } catch { /* private mode */ }
  }
  if (won) { confetti(world, 90); if (sfx) sfx.win(); }
  else if (sfx) sfx.lose();
  if (sfx) sfx.stopBuzz();
}

export function startRun(world, difficultyKey) {
  // Rebuilds the world in place so the running loop keeps its reference.
  const seed = (world.seed + 101) >>> 0;
  const fresh = createWorld(seed, difficultyKey);
  fresh.best = world.best;
  Object.assign(world, fresh);
  world.phase = 'playing';
  world.banner = { text: 'FILL THE HIVE BEFORE SUNSET!', sub: 'Gather pollen • dodge wasps • mind the webs', t: 0, dur: 2.8, color: '#b8860b' };
}
