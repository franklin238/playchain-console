import { useEffect, useRef } from "react";
import { pushLayer, type ActionHandler, type InputAction } from "./dispatcher";
import { activeScope, focusFirst } from "./spatial";

/** Register an input layer for the lifetime of the component. */
export function useInputLayer(handler: ActionHandler, priority = 0, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return pushLayer((action, source) => ref.current(action, source), priority);
  }, [priority, enabled]);
}

/** Run `fn` on Back (B / Escape) instead of the default "go back a screen". */
export function useBackHandler(fn: () => void, enabled = true, priority = 10) {
  useInputLayer(
    (action: InputAction) => {
      if (action !== "back") return false;
      fn();
      return true;
    },
    priority,
    enabled,
  );
}

/**
 * When the component mounts, move focus into `ref` (its data-nav-default
 * element, or its first focusable one) unless focus is already inside it.
 */
export function useAutoFocus(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(document.activeElement) && document.activeElement !== el) return;
      // A screen that finishes loading behind an open menu leaves the menu's focus alone.
      if (!activeScope().contains(el)) return;
      focusFirst(el);
    });
    return () => cancelAnimationFrame(frame);
  }, deps);
}

/** While `active`, remember what had focus; give it back when `active` ends. */
export function useRestoreFocus(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      if (previous && previous !== document.body && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active]);
}
