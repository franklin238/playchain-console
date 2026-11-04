import { dispatch, type InputAction } from "./dispatcher";

export function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** Keyboard: arrows move, Enter selects, Escape goes back, M opens the menu. */
export function installKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    const typing = isTextField(target);
    let action: InputAction | null = null;

    switch (e.key) {
      case "ArrowUp":
        if (target instanceof HTMLTextAreaElement) return;
        action = "up";
        break;
      case "ArrowDown":
        if (target instanceof HTMLTextAreaElement) return;
        action = "down";
        break;
      case "ArrowLeft":
        if (typing) return; // move the caret
        action = "left";
        break;
      case "ArrowRight":
        if (typing) return;
        action = "right";
        break;
      case "Enter":
        if (typing) return; // let forms submit
        if (e.repeat) return;
        action = "select";
        break;
      case "Escape":
        action = "back";
        break;
      case "Backspace":
        if (typing) return;
        action = "back";
        break;
      case "m":
      case "M":
      case "ContextMenu":
        if (typing) return;
        action = "menu";
        break;
    }

    if (action) {
      e.preventDefault();
      dispatch(action, "keyboard");
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
