// The postMessage bridge between a sandboxed game and the console (spec section 11).
// Games never get wallet access. Scores are display only and never go onchain.
//
//   game -> console  { type: "playchain:ready" | "playchain:exit" | "playchain:load" }
//                    { type: "playchain:score", score }       shown in the overlay only
//                    { type: "playchain:save", data }         kept in this browser, per game
//   console -> game  { type: "playchain:pause" | "playchain:resume" }
//                    { type: "playchain:loaded", data }
//                    { type: "playchain:mute", muted }        platform sound toggle

import { consoleConfig } from "../config/console.config";
import { readJson, writeJson } from "../lib/storage";

export type GameMessage =
  | { type: "playchain:ready" }
  | { type: "playchain:exit" }
  | { type: "playchain:load" }
  | { type: "playchain:score"; score: number }
  | { type: "playchain:save"; data: unknown };

/** Validate one message from a game. Anything unexpected is dropped (returns null). */
export function parseGameMessage(raw: unknown): GameMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case "playchain:ready":
    case "playchain:exit":
    case "playchain:load":
      return { type: m.type };
    case "playchain:score": {
      const s = m.score;
      if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 1e12) return null;
      return { type: "playchain:score", score: Math.floor(s) };
    }
    case "playchain:save": {
      let size = 0;
      try {
        size = new Blob([JSON.stringify(m.data ?? null)]).size;
      } catch {
        return null;
      }
      if (size > consoleConfig.saveMaxBytes) return null;
      return { type: "playchain:save", data: m.data ?? null };
    }
    default:
      return null;
  }
}

const saveKey = (slug: string) => `pcf.save.${slug}`;

export function loadGameSave(slug: string): unknown {
  return readJson<unknown>(saveKey(slug), null);
}

export function storeGameSave(slug: string, data: unknown): boolean {
  return writeJson(saveKey(slug), data);
}

/** Sandbox for game frames. Never add allow-same-origin: with allow-scripts it lets a game escape. */
export const GAME_SANDBOX = "allow-scripts allow-pointer-lock";
export const GAME_ALLOW = "fullscreen; gamepad; autoplay";
