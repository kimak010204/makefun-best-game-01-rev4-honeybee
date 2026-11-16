// HONEYBEE rev4 — tuning, flower types, difficulty and palette keyframes.
// One job: every number the game balances on lives here, so tuning never
// means hunting through logic or drawing code.

export const VIEW = { W: 1280, H: 720 };
export const GROUND_Y = 560; // top of the grass band
export const HIVE = { x: 1120, y: 300, r: 64 }; // hive centre on the oak
export const POUCH_MAX = 6;
export const HONEY_GOAL = 100; // honey units needed to win
export const COMBO_WINDOW = 4; // seconds to keep a combo alive
export const COMBO_MAX = 5;

export const DIFFICULTY = {
  easy: {
    label: 'EASY', time: 150, waspStart: 1, waspMax: 4, waspSpeed: 120,
    webCount: 1, powerupEvery: 16, queenDives: 2,
  },
  normal: {
    label: 'NORMAL', time: 120, waspStart: 2, waspMax: 6, waspSpeed: 150,
    webCount: 2, powerupEvery: 20, queenDives: 3,
  },
  hard: {
    label: 'HARD', time: 95, waspStart: 3, waspMax: 8, waspSpeed: 180,
    webCount: 3, powerupEvery: 24, queenDives: 4,
  },
};

// Flower kinds: value = pollen per bloom, respawn = seconds to regrow,
// weight = spawn share, glow = halo strength, height = stem length.
export const FLOWERS = {
  daisy:     { value: 1, respawn: 6,  weight: 30, glow: 0.25, stem: 46,
               petal: '#ffffff', core: '#ffcf3d', label: 'Daisy' },
  tulip:     { value: 2, respawn: 9,  weight: 24, glow: 0.35, stem: 52,
               petal: '#ff5d8f', core: '#ffd23d', label: 'Tulip' },
  lavender:  { value: 2, respawn: 12, weight: 18, glow: 0.4,  stem: 58,
               petal: '#9b7ede', core: '#6c4fc4', label: 'Lavender' },
  sunflower: { value: 3, respawn: 14, weight: 14, glow: 0.5,  stem: 86,
               petal: '#ffb400', core: '#7a4a12', label: 'Sunflower' },
  clover:    { value: 1, respawn: 5,  weight: 10, glow: 0.2,  stem: 34,
               petal: '#ff8fb0', core: '#ffe066', label: 'Clover' },
  golden:    { value: 5, respawn: 25, weight: 4,  glow: 1.0,  stem: 60,
               petal: '#ffd700', core: '#fff3a0', label: 'Golden Bloom' },
};

export const POWERUPS = {
  swift:  { label: 'SWIFT NECTAR', color: '#ff9f1c', secs: 8,  text: 'SPEED UP!' },
  shield: { label: 'HONEY SHIELD', color: '#4cc9f0', secs: 0,  text: 'SHIELD!' },
  magnet: { label: 'POLLEN MAGNET', color: '#b388ff', secs: 6, text: 'MAGNET!' },
};

// Sky palettes keyed by day progress t (0 = morning, 1 = sunset).
// Each entry: [top, mid, horizon, sun colour, sun y fraction].
export const SKY_KEYS = [
  { t: 0.00, top: '#5fb2f0', mid: '#a8dcf7', hor: '#fff3c4', sun: '#ffd93b', sunY: 0.16 },
  { t: 0.45, top: '#5aa7ec', mid: '#8ecdf5', hor: '#ffe9a8', sun: '#ffcf3d', sunY: 0.26 },
  { t: 0.70, top: '#7d8fe0', mid: '#f7b267', hor: '#ffc46b', sun: '#ff9e3d', sunY: 0.44 },
  { t: 0.88, top: '#6a5acd', mid: '#e86a92', hor: '#ff8a5c', sun: '#ff7b2f', sunY: 0.58 },
  { t: 1.00, top: '#3d3678', mid: '#c65d8f', hor: '#ff7a4d', sun: '#ff5e2e', sunY: 0.66 },
];

export const WASP_KINDS = {
  chaser:   { speed: 1.0,  r: 15, color: '#3a2b12', stripe: '#f7b500' },
  patroller:{ speed: 0.8,  r: 14, color: '#4a3410', stripe: '#ffb400' },
  ambusher: { speed: 1.25, r: 16, color: '#2e1f0a', stripe: '#ff7b00' },
};
