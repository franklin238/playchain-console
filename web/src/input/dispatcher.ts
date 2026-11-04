// One stream of console actions, whatever the input device.
//
// Keyboard, gamepad and pointer sources call `dispatch`. Layers registered with
// `pushLayer` see each action first (topmost / highest priority first) and can
// claim it by returning true. Anything left over goes to the default handler
// installed by <InputProvider>.

export type InputAction = "up" | "down" | "left" | "right" | "select" | "back" | "menu";
export type InputSource = "keyboard" | "gamepad" | "pointer";

export type ActionHandler = (action: InputAction, source: InputSource) => boolean | void;

interface Layer {
  id: number;
  priority: number;
  handler: ActionHandler;
}

let layers: Layer[] = [];
let nextLayerId = 1;
let defaultHandler: ActionHandler = () => {};
let inputMode: InputSource = "pointer";
const actionListeners = new Set<(action: InputAction, source: InputSource) => void>();

export function setDefaultHandler(handler: ActionHandler) {
  defaultHandler = handler;
}

/** Register a handler layer. Returns a function that removes it. */
export function pushLayer(handler: ActionHandler, priority = 0): () => void {
  const layer = { id: nextLayerId++, priority, handler };
  layers.push(layer);
  return () => {
    layers = layers.filter((l) => l !== layer);
  };
}

export function setInputMode(source: InputSource) {
  if (inputMode === source) return;
  inputMode = source;
  document.documentElement.dataset.input = source;
}

export function getInputMode(): InputSource {
  return inputMode;
}

/** Observe every action (controller test screen, sound effects). */
export function onAction(listener: (action: InputAction, source: InputSource) => void): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

export function dispatch(action: InputAction, source: InputSource) {
  setInputMode(source);
  for (const listener of actionListeners) listener(action, source);
  // Highest priority first; among equals, the most recently added first.
  const ordered = [...layers].sort((a, b) => b.priority - a.priority || b.id - a.id);
  for (const layer of ordered) {
    if (layer.handler(action, source) === true) return;
  }
  defaultHandler(action, source);
}
