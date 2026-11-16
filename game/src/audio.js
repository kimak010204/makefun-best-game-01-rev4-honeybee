// HONEYBEE rev4 — all sound, synthesised live with WebAudio.
// One job: every chirp, chime and buzz. No audio files, no network.
// Everything is guarded: no AudioContext (headless screenshots, muted
// browsers) means every call is a silent no-op.

import { Melody } from './music.js';

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buzz = null; // looping bee buzz nodes
    this.pad = null; // soft mood chord that follows the day
    this.melody = null; // gentle pentatonic arpeggio (music.js)
    this.mood = 'morning';
    this.chirpTimer = 3; // seconds until the next birdsong
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
    } catch {
      return false;
    }
    return true;
  }

  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.buzz) this.buzz.gain.gain.value = this.muted ? 0 : 0.035;
    if (this.pad) this.pad.gain.gain.value = this.muted ? 0 : 0.018;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click() { this.tone(660, 0.07, 'triangle', 0.12); }
  collect(combo) {
    const base = 520 + Math.min(combo, 5) * 70;
    this.tone(base, 0.1, 'sine', 0.16);
    this.tone(base * 1.5, 0.14, 'sine', 0.14, null, 0.05);
  }
  deliver(n) {
    this.tone(392, 0.1, 'triangle', 0.16);
    this.tone(523, 0.1, 'triangle', 0.16, null, 0.07);
    this.tone(659, 0.18, 'triangle', 0.18, null, 0.14);
    if (n >= 5) this.tone(784, 0.2, 'sine', 0.14, null, 0.2);
  }
  sting() {
    this.tone(180, 0.35, 'sawtooth', 0.22, 60);
    this.tone(90, 0.3, 'square', 0.12, 45, 0.02);
  }
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.14, null, i * 0.06));
  }
  queen() {
    this.tone(140, 0.6, 'sawtooth', 0.2, 70);
    this.tone(210, 0.5, 'sawtooth', 0.12, 90, 0.1);
  }
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, null, i * 0.11));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, null, i * 0.16));
  }

  // Continuous bee buzz whose pitch follows flight speed.
  startBuzz() {
    if (!this.ensure() || this.buzz) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = 190;
    osc2.type = 'sawtooth'; osc2.frequency.value = 196;
    filter.type = 'lowpass'; filter.frequency.value = 900;
    g.gain.value = this.muted ? 0 : 0.035;
    osc.connect(filter); osc2.connect(filter);
    filter.connect(g).connect(this.ctx.destination);
    osc.start(); osc2.start();
    this.buzz = { osc, osc2, gain: g };
  }

  setBuzz(speed01) {
    if (!this.buzz) return;
    const f = 175 + speed01 * 90;
    this.buzz.osc.frequency.value = f;
    this.buzz.osc2.frequency.value = f * 1.03;
  }

  stopBuzz() {
    if (!this.buzz) return;
    try { this.buzz.osc.stop(); this.buzz.osc2.stop(); } catch { /* already stopped */ }
    this.buzz = null;
  }

  // A soft pad chord that follows the day: bright morning, warm golden
  // hour, tender dusk, a lift on victory. Starts only after a user
  // gesture, stays very quiet, never touches game state.
  static MOODS = {
    morning: [261.63, 329.63, 392.0],
    golden: [220.0, 277.18, 329.63],
    dusk: [220.0, 261.63, 329.63],
    win: [523.25, 659.25, 783.99],
  };

  startPad() {
    if (!this.ensure() || this.pad) return;
    const oscs = SoundBank.MOODS[this.mood].map((f) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      return o;
    });
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.value = this.muted ? 0 : 0.018;
    for (const o of oscs) { o.connect(filter); o.start(); }
    filter.connect(g).connect(this.ctx.destination);
    this.pad = { oscs, gain: g };
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (!this.pad) return;
    const freqs = SoundBank.MOODS[mood];
    const t = this.ctx.currentTime;
    this.pad.oscs.forEach((o, i) => {
      o.frequency.setTargetAtTime(freqs[i], t, 0.6);
    });
  }

  stopPad() {
    if (!this.pad) return;
    try { for (const o of this.pad.oscs) o.stop(); } catch { /* already stopped */ }
    this.pad = null;
  }

  // Called every frame: pick the chord for the phase and the hour.
  updateMood(dayT, phase) {
    let mood = 'morning';
    if (phase === 'win') mood = 'win';
    else if (phase === 'lose') mood = 'dusk';
    else if (phase === 'playing' || phase === 'title') {
      mood = dayT < 0.45 ? 'morning' : dayT < 0.75 ? 'golden' : 'dusk';
    }
    if (!this.pad) this.startPad();
    this.setMood(mood);
  }

  // Gentle background arpeggio: plays on the title screen and while
  // flying, stops on pause and on the end screens. Never touches game
  // state; silent without an AudioContext.
  updateMelody(phase, dayT) {
    if (!this.melody) this.melody = new Melody(() => this.ctx, () => this.muted);
    let mood = 'morning';
    if (phase === 'playing' || phase === 'title') {
      mood = dayT < 0.45 ? 'morning' : dayT < 0.75 ? 'golden' : 'dusk';
    }
    this.melody.setMood(mood);
    this.melody.setActive((phase === 'playing' || phase === 'title') && this.ensure());
    this.melody.update();
  }

  // Occasional birdsong while the meadow is alive: two to four quick
  // descending chirps, every few seconds. Silent when muted or when
  // there is no audio context; never touches game state.
  updateAmbience(dt, active) {
    if (!active) return;
    this.chirpTimer -= dt;
    if (this.chirpTimer > 0) return;
    this.chirpTimer = 4 + Math.random() * 6;
    if (this.muted || !this.ensure()) return;
    const base = 2200 + Math.random() * 1200;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.tone(base + Math.random() * 500, 0.09, 'sine', 0.05, base * 0.8, i * 0.11);
    }
  }
}
