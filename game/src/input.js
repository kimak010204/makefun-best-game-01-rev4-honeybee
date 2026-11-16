// HONEYBEE rev4 — keyboard and mouse input.
// One job: turn raw events into a small, testable input state:
// a direction vector, edge-triggered action keys, and pointer position.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    ax: 0, ay: 0, // analogue-ish direction from held keys
    mouseX: 640, mouseY: 360, mouseDown: false, mouseMoved: false,
    pressed: new Set(), // keys pressed since last consume()
    clicked: null, // { x, y } of the last click, consumed by the game
  };

  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.key)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      input.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    }
    updateAxes(input);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    updateAxes(input);
  });
  window.addEventListener('blur', () => { input.keys.clear(); updateAxes(input); });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    input.mouseMoved = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    input.mouseDown = true;
    input.clicked = { x: input.mouseX, y: input.mouseY };
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });

  return input;
}

function updateAxes(input) {
  const k = input.keys;
  input.ax = (k.has('d') || k.has('ArrowRight') ? 1 : 0) - (k.has('a') || k.has('ArrowLeft') ? 1 : 0);
  input.ay = (k.has('s') || k.has('ArrowDown') ? 1 : 0) - (k.has('w') || k.has('ArrowUp') ? 1 : 0);
}

export function wasPressed(input, key) {
  return input.pressed.has(key);
}

export function consumeFrame(input) {
  input.pressed.clear();
  input.clicked = null;
}
