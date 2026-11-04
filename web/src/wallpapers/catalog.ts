export const WALLPAPERS = [
  { id: "aurora", name: "Crimson Aurora", note: "Slow red and gold light", animated: true },
  { id: "rain", name: "Midnight Rain", note: "Rain over a sleeping city", animated: true },
  { id: "nebula", name: "Nebula", note: "Stars and drifting clouds", animated: true },
  { id: "neon", name: "Neon Horizon", note: "Retro sunset and grid", animated: true },
  { id: "embers", name: "Embers", note: "Rising sparks", animated: true },
  { id: "silk", name: "Silk", note: "Flowing lines", animated: true },
  { id: "charcoal", name: "Charcoal", note: "Plain and quiet", animated: false },
  { id: "game-art", name: "Game art", note: "Follows the game you select", animated: false },
  { id: "custom", name: "Your image", note: "Upload your own", animated: false },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

export const DEFAULT_WALLPAPER: WallpaperId = "aurora";

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((w) => w.id === value);
}
