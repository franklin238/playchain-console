export const WALLPAPERS = [
  { id: "aurora", name: "Crimson Aurora", note: "Slow red and gold light", animated: true },
  { id: "rain", name: "Midnight Rain", note: "Rain over a sleeping city", animated: true },
  { id: "nebula", name: "Nebula", note: "Stars and drifting clouds", animated: true },
  { id: "neon", name: "Neon Horizon", note: "Retro sunset and grid", animated: true },
  { id: "embers", name: "Embers", note: "Rising sparks", animated: true },
  { id: "silk", name: "Silk", note: "Flowing lines", animated: true },
  { id: "ocean", name: "Deep Sea", note: "Light rays and rising bubbles", animated: true },
  { id: "sakura", name: "Night Blossom", note: "Petals drifting through the dark", animated: true },
  { id: "peaks", name: "Moonlit Peaks", note: "Mountains under a quiet moon", animated: true },
  { id: "circuit", name: "Circuit", note: "Signals racing along a board", animated: true },
  { id: "dunes", name: "Desert Dusk", note: "Warm dunes at sunset", animated: true },
  { id: "snow", name: "Snowfall", note: "Soft snow on a winter night", animated: true },
  { id: "lava", name: "Lava Lamp", note: "Slow glowing blobs", animated: true },
  { id: "prism", name: "Prism", note: "Turning shards of colour", animated: true },
  { id: "fireflies", name: "Firefly Forest", note: "Fireflies among the pines", animated: true },
  { id: "charcoal", name: "Charcoal", note: "Plain and quiet", animated: false },
  { id: "game-art", name: "Game art", note: "Follows the game you select", animated: false },
  { id: "custom", name: "Your image", note: "Upload your own", animated: false },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

export const DEFAULT_WALLPAPER: WallpaperId = "charcoal";

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((w) => w.id === value);
}
