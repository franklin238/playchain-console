// Gamepad API polling. Uses the "standard" button layout:
//   0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View/Select, 9 Start,
//   10 L3, 11 R3, 12 Up, 13 Down, 14 Left, 15 Right, 16 Home
// D-pad or left stick moves, A selects, B goes back, Start (or Home) opens the menu.

import { dispatch, type InputAction } from "./dispatcher";

export const BUTTON = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16,
} as const;

export const BUTTON_NAMES = [
  "A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Start", "L3", "R3", "Up", "Down", "Left", "Right", "Home",
];

export interface PadSnapshot {
  index: number;
  id: string;
  mapping: string;
  buttons: boolean[];
  axes: number[];
}

const STICK_THRESHOLD = 0.5;
const REPEAT_DELAY_MS = 380;
const REPEAT_RATE_MS = 110;

type Dir = "up" | "down" | "left" | "right";
const DIRS: Dir[] = ["up", "down", "left", "right"];

const snapshotListeners = new Set<(pads: PadSnapshot[]) => void>();

/** Live gamepad state, for the controller test screen and hold-to-approve. */
export function onPadState(listener: (pads: PadSnapshot[]) => void): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

function readPads(): Gamepad[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
  } catch {
    return [];
  }
}

export function installGamepad(): () => void {
  if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return () => {};

  const prevButtons = new Map<number, boolean[]>();
  const held: Record<Dir, { since: number; next: number } | null> = { up: null, down: null, left: null, right: null };
  let raf = 0;
  let running = false;

  const edge = (pad: number, pressed: boolean[], button: number) =>
    pressed[button] && !(prevButtons.get(pad)?.[button] ?? false);

  const tick = (now: number) => {
    const pads = readPads();
    if (pads.length === 0) {
      running = false;
      if (snapshotListeners.size) for (const l of snapshotListeners) l([]);
      return;
    }

    const anyDir: Record<Dir, boolean> = { up: false, down: false, left: false, right: false };
    const snapshots: PadSnapshot[] = [];
    const actions: InputAction[] = [];

    for (const pad of pads) {
      const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      anyDir.up ||= !!pressed[BUTTON.UP] || ay < -STICK_THRESHOLD;
      anyDir.down ||= !!pressed[BUTTON.DOWN] || ay > STICK_THRESHOLD;
      anyDir.left ||= !!pressed[BUTTON.LEFT] || ax < -STICK_THRESHOLD;
      anyDir.right ||= !!pressed[BUTTON.RIGHT] || ax > STICK_THRESHOLD;

      if (edge(pad.index, pressed, BUTTON.A)) actions.push("select");
      if (edge(pad.index, pressed, BUTTON.B)) actions.push("back");
      if (edge(pad.index, pressed, BUTTON.START) || edge(pad.index, pressed, BUTTON.HOME)) actions.push("menu");

      prevButtons.set(pad.index, pressed);
      snapshots.push({ index: pad.index, id: pad.id, mapping: pad.mapping, buttons: pressed, axes: [...pad.axes] });
    }

    // Directions repeat while held, like a console menu.
    for (const dir of DIRS) {
      const state = held[dir];
      if (anyDir[dir]) {
        if (!state) {
          held[dir] = { since: now, next: now + REPEAT_DELAY_MS };
          actions.unshift(dir);
        } else if (now >= state.next) {
          state.next = now + REPEAT_RATE_MS;
          actions.unshift(dir);
        }
      } else {
        held[dir] = null;
      }
    }

    for (const action of actions) dispatch(action, "gamepad");
    if (snapshotListeners.size) for (const l of snapshotListeners) l(snapshots);
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("gamepadconnected", start);
  // Some browsers only report pads after a button press; check once at start.
  if (readPads().length) start();

  return () => {
    window.removeEventListener("gamepadconnected", start);
    cancelAnimationFrame(raf);
    running = false;
  };
}
