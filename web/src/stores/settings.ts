import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { consoleConfig, type ChainKind } from "../config/console.config";
import { safeLocalStorage } from "../lib/storage";
import { DEFAULT_WALLPAPER, type WallpaperId } from "../wallpapers/catalog";

export interface SettingsState {
  defaultChain: ChainKind;
  /** 0 to 100 */
  musicVolume: number;
  /** 0 to 100 */
  sfxVolume: number;
  muted: boolean;
  reduceMotion: boolean;
  wallpaper: WallpaperId;
  /** 0 to 80: darkens the wallpaper so text stays readable. */
  wallpaperDim: number;
  /** 0 to 30 px: blurs your own image. */
  wallpaperBlur: number;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultChain: consoleConfig.defaultChain,
      musicVolume: 40,
      sfxVolume: 60,
      muted: false,
      reduceMotion: false,
      wallpaper: DEFAULT_WALLPAPER,
      wallpaperDim: 0,
      wallpaperBlur: 0,
      set: (patch) => set(patch),
    }),
    {
      name: "playchain.settings",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** True when the player or the operating system asked for less motion. */
export function prefersReducedMotion(): boolean {
  if (useSettings.getState().reduceMotion) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
