import { getInputMode, setInputMode } from "./dispatcher";
import { isTextField } from "./keyboard";
import { activeScope, focusables } from "./spatial";

/**
 * Mouse and touch. Hovering an item selects it, so there is always exactly one
 * selected item with a visible focus ring, whatever the input device.
 */
export function installPointer(): () => void {
  let lastX = -1;
  let lastY = -1;

  const onMove = (e: PointerEvent) => {
    // Ignore synthetic moves caused by scrolling under a still mouse.
    if (e.clientX === lastX && e.clientY === lastY) return;
    lastX = e.clientX;
    lastY = e.clientY;
    setInputMode("pointer");
  };

  const onOver = (e: MouseEvent) => {
    if (getInputMode() !== "pointer") return;
    if (isTextField(document.activeElement)) return; // never steal focus from typing
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      "button, a[href], [tabindex]:not([tabindex='-1'])",
    );
    if (!target || target === document.activeElement || isTextField(target)) return;
    if (!activeScope().contains(target) || !focusables().includes(target)) return;
    target.focus({ preventScroll: true });
  };

  const onDown = () => setInputMode("pointer");

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  document.addEventListener("mouseover", onOver);
  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    document.removeEventListener("mouseover", onOver);
  };
}
