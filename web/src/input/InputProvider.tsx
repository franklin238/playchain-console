import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { installUiSounds, playSfx, unlockAudio } from "../audio/engine";
import { prefersReducedMotion } from "../stores/settings";
import { useUi } from "../stores/ui";
import { onAction, setDefaultHandler } from "./dispatcher";
import { installGamepad } from "./gamepad";
import { installKeyboard, isTextField } from "./keyboard";
import { installPointer } from "./pointer";
import { activeScope, moveFocus } from "./spatial";

/**
 * Installs keyboard, gamepad and pointer input and the default behaviour for
 * each action: move focus, click the selected item, go back, open the menu.
 */
export function InputProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const removers = [installKeyboard(), installGamepad(), installPointer(), installUiSounds()];

    // Any user gesture unlocks audio (browsers block it before one).
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const stopUnlockOnAction = onAction(unlock);

    return () => {
      removers.forEach((r) => r());
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      stopUnlockOnAction();
    };
  }, []);

  useEffect(() => {
    setDefaultHandler((action) => {
      const active = document.activeElement as HTMLElement | null;
      const ui = useUi.getState();

      switch (action) {
        case "up":
        case "down":
        case "left":
        case "right": {
          // Sliders and similar controls take left/right themselves.
          if ((action === "left" || action === "right") && active?.dataset.navConsume === "horizontal") {
            active.dispatchEvent(new CustomEvent("navadjust", { detail: action }));
            return;
          }
          if (moveFocus(action, { smooth: !prefersReducedMotion() })) {
            // the note follows where focus landed, so moving along the shelf plays a melody
            const r = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
            playSfx("move", r ? (r.left + r.width / 2) / Math.max(1, window.innerWidth) : 0.5);
          }
          return;
        }
        case "select": {
          if (!active || active === document.body || !activeScope().contains(active)) {
            moveFocus("down");
            return;
          }
          if (isTextField(active)) return;
          playSfx("select");
          active.click();
          return;
        }
        case "back": {
          if (ui.notificationsOpen) return ui.setNotificationsOpen(false);
          if (ui.guideOpen) return ui.setGuideOpen(false);
          if (isTextField(active)) {
            active?.blur();
            return;
          }
          // The address, not the screen: a screen still loading leaves the old one showing.
          if (window.location.pathname === "/") return;
          playSfx("back");
          if (window.history.state?.key) navigate(-1);
          else navigate("/");
          return;
        }
        case "menu": {
          playSfx("open");
          ui.setGuideOpen(!ui.guideOpen);
          return;
        }
      }
    });
  }, [navigate]);

  return <>{children}</>;
}
