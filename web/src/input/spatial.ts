// Spatial navigation: move focus to the nearest focusable element in a
// direction, the way a TV or console menu does.
//
// Focus scopes: an element with data-nav-scope="modal" traps navigation while
// it is in the page (the topmost one wins). Elements inside data-nav-skip or
// an inert subtree are ignored.

export type Direction = "up" | "down" | "left" | "right";

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type=hidden])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function activeScope(): HTMLElement {
  const scopes = document.querySelectorAll<HTMLElement>('[data-nav-scope="modal"]');
  return scopes.length ? scopes[scopes.length - 1] : document.body;
}

function isShown(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

export function focusables(scope: HTMLElement = activeScope()): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[data-nav-skip],[inert]") && isShown(el),
  );
}

/** Distance between two 1-D ranges, 0 when they overlap. */
function gap(a1: number, a2: number, b1: number, b2: number): number {
  if (a2 < b1) return b1 - a2;
  if (b2 < a1) return a1 - b2;
  return 0;
}

export function findNext(from: DOMRect, dir: Direction, candidates: { el: HTMLElement; rect: DOMRect }[]) {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const { el, rect: r } of candidates) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let primary: number;
    let cross: number;
    switch (dir) {
      case "right":
        if (cx <= fx + 1) continue;
        primary = r.left - from.right;
        cross = gap(from.top, from.bottom, r.top, r.bottom);
        break;
      case "left":
        if (cx >= fx - 1) continue;
        primary = from.left - r.right;
        cross = gap(from.top, from.bottom, r.top, r.bottom);
        break;
      case "down":
        if (cy <= fy + 1) continue;
        primary = r.top - from.bottom;
        cross = gap(from.left, from.right, r.left, r.right);
        break;
      case "up":
        if (cy >= fy - 1) continue;
        primary = from.top - r.bottom;
        cross = gap(from.left, from.right, r.left, r.right);
        break;
    }
    // Prefer elements in line with the current one; break ties by centre distance.
    const centre = dir === "left" || dir === "right" ? Math.abs(cy - fy) : Math.abs(cx - fx);
    const score = Math.max(primary, 0) + cross * 3 + (cross > 0 ? 1000 : 0) + centre * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function focusElement(el: HTMLElement, opts: { smooth?: boolean } = {}) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: opts.smooth ? "smooth" : "auto" });
}

/** Focus the scope's preferred element: data-nav-default, else the first one. */
export function focusFirst(scope: HTMLElement = activeScope()): boolean {
  const items = focusables(scope);
  const preferred = items.find((el) => el.hasAttribute("data-nav-default")) ?? items[0];
  if (!preferred) return false;
  focusElement(preferred);
  return true;
}

/** Move focus one step. Returns true when focus moved. */
export function moveFocus(dir: Direction, opts: { smooth?: boolean } = {}): boolean {
  const scope = activeScope();
  const current = document.activeElement as HTMLElement | null;
  const items = focusables(scope);
  if (!current || current === document.body || !scope.contains(current) || !items.includes(current)) {
    // Nothing selected yet: start in the page content rather than the top bar.
    const main = scope === document.body ? document.querySelector<HTMLElement>("main") : null;
    return (main && focusFirst(main)) || focusFirst(scope);
  }
  const candidates = items.filter((el) => el !== current).map((el) => ({ el, rect: el.getBoundingClientRect() }));
  const next = findNext(current.getBoundingClientRect(), dir, candidates);
  if (!next) return false;
  focusElement(next, opts);
  return true;
}
