import { useEffect, useState } from "react";
import { useSettings } from "../stores/settings";

const isFull = () => !!document.fullscreenElement;
let declined = false; // the player left fullscreen with the X: don't pull them back in this visit

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
      className="fixed right-1.5 top-1.5 z-[70] grid size-8 place-items-center rounded-full border border-line-strong bg-bg/85 text-base font-bold text-fg backdrop-blur hover:border-accent hover:text-accent"
    >
      ✕
    </button>
  );
}
