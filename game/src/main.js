// HONEYBEE rev4 — bootstrap and the main loop.
// One job: wire canvas, input, sound and the state machine together,
// run the fixed-clamped frame loop, and drive the shot scenes used for
// screenshots. No game rules here; those live in update.js.

import { VIEW } from './config.js';
import { createWorld } from './world.js';
import { update, startRun } from './update.js';
import { render, dayProgress } from './render.js';
import { createInput, wasPressed, consumeFrame } from './input.js';
import { SoundBank } from './audio.js';
import { buildShotWorld } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.W;
canvas.height = VIEW.H;

const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const seed = Number(params.get('seed') || 20261116);

const sfx = new SoundBank();
const input = createInput(canvas);

let world;
let shotFrames = 0;
if (shotScene) {
  world = buildShotWorld(shotScene, seed);
} else {
  world = createWorld((Date.now() % 2147483647) >>> 0, 'normal');
}

function clickOnTitle(mx, my) {
  if (!world._titleButtons) return null;
  for (const b of world._titleButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.key;
  }
  return null;
}

function handlePhaseKeys() {
  if (wasPressed(input, 'm')) {
    const muted = sfx.toggleMute();
    document.getElementById('mute').textContent = muted ? '🔇 muted' : '🔊 sound on';
  }
  if (world.phase === 'title') {
    if (wasPressed(input, '1')) world.difficultyKey = 'easy';
    if (wasPressed(input, '2')) world.difficultyKey = 'normal';
    if (wasPressed(input, '3')) world.difficultyKey = 'hard';
    const clicked = input.clicked ? clickOnTitle(input.clicked.x, input.clicked.y) : null;
    if (wasPressed(input, ' ') || wasPressed(input, 'Enter') || clicked) {
      if (clicked) world.difficultyKey = clicked;
      sfx.resume();
      sfx.startBuzz();
      sfx.startPad();
      startRun(world, world.difficultyKey);
    }
    return;
  }
  if (world.phase === 'playing') {
    if (wasPressed(input, 'p') || wasPressed(input, 'Escape')) {
      world.phase = 'paused';
      sfx.stopBuzz();
    }
    return;
  }
  if (world.phase === 'paused') {
    if (wasPressed(input, 'p') || wasPressed(input, 'Escape') || wasPressed(input, ' ')) {
      world.phase = 'playing';
      sfx.resume();
      sfx.startBuzz();
    }
    if (wasPressed(input, 'r')) restart();
    return;
  }
  // win / lose
  if (wasPressed(input, 'r') || wasPressed(input, ' ') || wasPressed(input, 'Enter')) {
    restart();
  }
}

function restart() {
  sfx.resume();
  sfx.startBuzz();
  sfx.startPad();
  startRun(world, world.difficultyKey);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  if (shotScene) {
    // Deterministic shots: advance a few fixed frames, then freeze so the
    // render is identical every time the page loads.
    if (shotFrames < 50) {
      update(world, input, 1 / 60, null);
      shotFrames++;
      if (shotFrames === 50) window.__shotReady = true;
    }
  } else {
    handlePhaseKeys();
    if (world.phase === 'playing' || world.phase === 'win' || world.phase === 'lose' || world.phase === 'title') {
      update(world, input, dt, sfx);
    }
    if (world.phase === 'playing' && sfx.buzz === null) sfx.startBuzz();
    if (world.phase !== 'playing') sfx.stopBuzz();
    sfx.updateAmbience(dt, world.phase === 'playing' || world.phase === 'title');
    sfx.updateMood(dayProgress(world), world.phase);
    sfx.updateMelody(world.phase, dayProgress(world));
  }

  render(ctx, world);
  consumeFrame(input);
  requestAnimationFrame(frame);
}

document.getElementById('mute').addEventListener('click', () => {
  const muted = sfx.toggleMute();
  document.getElementById('mute').textContent = muted ? '🔇 muted' : '🔊 sound on';
});

requestAnimationFrame(frame);
