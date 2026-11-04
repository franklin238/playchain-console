import { describe, expect, it } from "vitest";
import { findNext } from "../../src/input/spatial";

const rect = (left: number, top: number, width = 100, height = 60) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

const item = (name: string, r: DOMRect) => ({ el: { name } as unknown as HTMLElement, rect: r });

describe("spatial navigation", () => {
  // A top bar row and a tile row below it.
  const tabHome = item("tabHome", rect(0, 0));
  const tabStore = item("tabStore", rect(150, 0));
  const tile1 = item("tile1", rect(0, 200, 300, 170));
  const tile2 = item("tile2", rect(340, 200, 300, 170));
  const tile3 = item("tile3", rect(680, 200, 300, 170));
  const all = [tabHome, tabStore, tile1, tile2, tile3];
  const name = (el: HTMLElement | null) => (el as unknown as { name: string } | null)?.name;

  it("moves along a row", () => {
    expect(name(findNext(tile1.rect, "right", all))).toBe("tile2");
    expect(name(findNext(tile2.rect, "left", all))).toBe("tile1");
  });

  it("stops at the end of a row", () => {
    expect(findNext(tile3.rect, "right", all)).toBeNull();
  });

  it("goes up into the top bar and down into the content", () => {
    // Up picks the item most centred above (tile1 centre x=150, tabStore centre x=200).
    expect(name(findNext(tile1.rect, "up", all))).toBe("tabStore");
    expect(name(findNext(tile3.rect, "up", all))).toBe("tabStore");
    expect(name(findNext(tabStore.rect, "down", all))).toBe("tile1");
  });

  it("prefers items in line over closer diagonal ones", () => {
    const below = item("below", rect(0, 400, 300, 100));
    const diagonal = item("diagonal", rect(330, 260, 100, 60));
    expect(name(findNext(tile1.rect, "down", [below, diagonal]))).toBe("below");
  });
});
