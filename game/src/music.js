// HONEYBEE rev4 — background melody (polish pass 4).
// One job: a gentle pentatonic arpeggio loop, synthesised live with
// WebAudio. The structure is fixed — a 16-step pattern over a
// pentatonic scale — so it sounds the same every run. It never reads
// or writes game state, and it is a silent no-op without an
// AudioContext, while muted, or while paused.

const SCALES = {
  morning: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
  golden: [440.0, 493.88, 554.37, 659.25, 739.99, 880.0],
  dusk: [440.0, 523.25, 587.33, 659.25, 783.99, 880.0],
  win: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0],
};
// 16 steps of scale degrees; -1 is a rest. A slow, lilting line that
// rises and falls like a bee wandering the meadow.
const PATTERN = [0, -1, 2, -1, 4, 3, 2, -1, 5, -1, 4, 2, 3, 2, 1, -1];
const STEP_SECS = 0.46;

export class Melody {
  constructor(getCtx, isMuted) {
    this.getCtx = getCtx;   // () => AudioContext | null
    this.isMuted = isMuted; // () => boolean
    this.gain = null;
    this.step = 0;
    this.nextTime = 0;
    this.mood = 'morning';
    this.active = false;
  }

  setMood(mood) {
    if (SCALES[mood]) this.mood = mood;
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    if (!active) {
      this.nextTime = 0;
      if (this.gain) this.gain.gain.value = 0;
      return;
    }
    const ctx = this.getCtx();
    if (!ctx) { this.active = false; return; }
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.isMuted() ? 0 : 0.9;
      this.gain.connect(ctx.destination);
    }
    this.gain.gain.value = this.isMuted() ? 0 : 0.9;
    this.nextTime = ctx.currentTime + 0.1;
  }

  // Schedule notes a little ahead of the playhead; call every frame.
  update() {
    if (!this.active) return;
    const ctx = this.getCtx();
    if (!ctx || !this.gain) return;
    this.gain.gain.value = this.isMuted() ? 0 : 0.9;
    const scale = SCALES[this.mood];
    while (this.nextTime < ctx.currentTime + 0.4) {
      const deg = PATTERN[this.step % PATTERN.length];
      if (deg >= 0) this.note(scale[deg], this.nextTime);
      // A soft root pulse every bar keeps the line grounded.
      if (this.step % 8 === 0) this.note(scale[0] / 2, this.nextTime, 'triangle', 0.035, 1.4);
      this.step++;
      this.nextTime += STEP_SECS;
    }
  }

  note(freq, t0, type = 'sine', vol = 0.05, dur = 1.1) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.gain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}
