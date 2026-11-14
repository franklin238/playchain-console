import { describe, expect, it } from "vitest";
import { validateMeta } from "../../src/games/meta";
import { parseGameMessage } from "../../src/games/gameBridge";

const good = {
  name: "Neon Tide",
  slug: "neon-tide",
  tagline: "A racing game where the track is a living tide.",
  description: "Ride the tide.",
  genre: "Action",
  developer: { name: "Duke", x: "dukedotsol" },
  cover: "https://playchain-console.vercel.app/games/neon-tide/cover.png",
  playUrl: "https://playchain-console.vercel.app/games/neon-tide/index.html",
  controls: "Space to dive",
  version: "1.0.0",
};

describe("validateMeta", () => {
  it("accepts a valid meta.json", () => {
    const r = validateMeta(good);
    expect(r.ok).toBe(true);
    expect(r.meta?.slug).toBe("neon-tide");
  });
  it("rejects non-https cover and playUrl", () => {
    const r = validateMeta({ ...good, cover: "http://x.com/a.png", playUrl: "javascript:alert(1)" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cover/);
    expect(r.errors.join(" ")).toMatch(/playUrl/);
  });
  it("caps lengths and checks fields", () => {
    expect(validateMeta({ ...good, description: "x".repeat(401) }).ok).toBe(false);
    expect(validateMeta({ ...good, slug: "Bad Slug" }).ok).toBe(false);
    expect(validateMeta({ ...good, genre: "Casino" }).ok).toBe(false);
    expect(validateMeta({ ...good, developer: { name: "a", x: "@nope" } }).ok).toBe(false);
    expect(validateMeta(null).ok).toBe(false);
    expect(validateMeta("string").ok).toBe(false);
  });
});

describe("parseGameMessage", () => {
  it("accepts the known messages", () => {
    expect(parseGameMessage({ type: "playchain:ready" })).toEqual({ type: "playchain:ready" });
    expect(parseGameMessage({ type: "playchain:exit", extra: 1 })).toEqual({ type: "playchain:exit" });
    expect(parseGameMessage({ type: "playchain:score", score: 12.7 })).toEqual({ type: "playchain:score", score: 12 });
    expect(parseGameMessage({ type: "playchain:save", data: { best: 3 } })).toEqual({ type: "playchain:save", data: { best: 3 } });
  });
  it("drops anything else", () => {
    expect(parseGameMessage(null)).toBeNull();
    expect(parseGameMessage("playchain:exit")).toBeNull();
    expect(parseGameMessage({ type: "playchain:sign", tx: "0x" })).toBeNull();
    expect(parseGameMessage({ type: "playchain:score", score: -1 })).toBeNull();
    expect(parseGameMessage({ type: "playchain:score", score: "9" })).toBeNull();
    expect(parseGameMessage({ type: "playchain:save", data: "x".repeat(70_000) })).toBeNull();
  });
});
