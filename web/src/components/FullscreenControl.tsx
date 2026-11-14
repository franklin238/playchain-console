import { useEffect, useState } from "react";
import { useSettings } from "../stores/settings";

const isFull = () => !!document.fullscreenElement;
let declined = false; // the player left fullscreen with the X: don't pull them back in this visit

/*
 * Esc means "back" in PlayChain and in every game, so while fullscreen we ask the browser to give
 * us the Esc key (Keyboard Lock, Chrome and Edge). Fullscreen is then left with the on-screen
 * buttons instead; holding Esc down for about two seconds still leaves it, as a browser safety net.
 * Other browsers ignore this and keep their usual Esc behaviour.
 */
type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
const keyboard = (): KeyboardLock | undefined => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
function syncEscLock() {
  const kb = keyboard();
  if (!kb) return;
  if (isFull()) void kb.lock?.(["Escape"]).catch(() => {});
  else kb.unlock?.();
}
if (typeof document !== "undefined") document.addEventListener("fullscreenchange", syncEscLock);

/** Live fullscreen state for buttons. */
export function useIsFullscreen(): boolean {
  const [full, setFull] = useState(isFull);
  useEffect(() => {
    const onChange = () => setFull(isFull());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return full;
}

/** One press goes fullscreen, the next press goes back to the window. */
export function toggleFullscreen() {
  if (isFull()) exitFullscreen();
  else { declined = false; enterFullscreen(); }
}

/* Games always run fullscreen. Call this from the Play button's click (browsers only allow
   fullscreen during a click or key press). */
let enteredForGame = false;
export function enterGameFullscreen() {
  if (isFull()) return;
  enteredForGame = true;
  enterFullscreen();
}
/** Leaving a game: go back to a window only if the console wasn't meant to be fullscreen. */
export function leaveGameFullscreen() {
  const keep = useSettings.getState().autoFullscreen && !declined;
  if (enteredForGame && !keep && isFull()) void document.exitFullscreen?.().catch(() => {});
  enteredForGame = false;
}

export function enterFullscreen() {
  if (isFull() || !document.fullscreenEnabled) return;
  void document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
}
export function exitFullscreen() {
  declined = true;
  if (isFull()) void document.exitFullscreen?.().catch(() => {});
}

/**
 * Opens PlayChain in fullscreen. Browsers only allow fullscreen after a click or key press, so the
 * console goes fullscreen on the first one (usually skipping the boot screen). While fullscreen,
 * an X in the corner returns to the normal window.
 */
export function FullscreenControl({ hidden }: { hidden?: boolean }) {
  const auto = useSettings((s) => s.autoFullscreen);
  const [full, setFull] = useState(isFull);

  useEffect(() => {
    const onChange = () => setFull(isFull());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const go = (e: Event) => {
      if (declined || isFull()) return;
      // never steal the first click on the X itself or on a text field
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-fs-exit], [data-fs-toggle], input, textarea, select")) return;
      enterFullscreen();
    };
    window.addEventListener("pointerdown", go, { capture: true });
    window.addEventListener("keydown", go, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", go, { capture: true });
      window.removeEventListener("keydown", go, { capture: true });
    };
  }, [auto]);

  if (!full || hidden) return null;
  return (
    <button
      type="button"
      data-fs-exit
      data-sfx="back"
      onClick={exitFullscreen}
      aria-label="Leave fullscreen"
      title="Leave fullscreen"
      // On phones the top bar's own fullscreen button sits right here, and this X would cover Connect.
      className="fixed right-1.5 top-1.5 z-[70] hidden size-8 place-items-center rounded-full sm:grid border border-line-strong bg-bg/85 text-base font-bold text-fg backdrop-blur hover:border-accent hover:text-accent"
    >
      ✕
    </button>
  );
}
