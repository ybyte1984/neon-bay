// Keyboard and pointer input for Neon Bay. Held keys give a movement
// vector; one-shot presses (enter car, punch, pause, mute, confirm) are
// queued as bit flags and taken once by the loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    // One-shot keys are independent ifs, not else-ifs: Space is both
    // confirm (start the game from the title screen) and punch (in play).
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    if (PUNCH.has(event.code)) { actions |= ACTION_PUNCH; event.preventDefault(); }
    if (MUTE.has(event.code)) actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); });
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  function has(set) { for (const k of set) if (held.has(k)) return true; return false; }
  return {
    /** Movement vector for walking: mx -1..1, my -1..1 (my +1 is south). */
    move() {
      const mx = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const my = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { mx, my, run: has(RUN) };
    },
    /** Driving: throttle +1 forward / -1 reverse, steer -1..1. */
    drive() {
      const throttle = (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
      const steer = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      return { throttle, steer };
    },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
