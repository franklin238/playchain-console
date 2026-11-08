import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeLocalStorage } from "../lib/storage";
import { DEFAULT_THEME, type ThemeId } from "../theme/themes";
import { DEFAULT_WALLPAPER, type WallpaperId } from "../wallpapers/catalog";

export type MusicTrackId = "aurora" | "glass" | "nebula" | "harbor" | "pulse";

export interface SettingsState {
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
  /** Colour theme for the whole console. */
  theme: ThemeId;
  /** Menu music. */
  musicTrack: MusicTrackId;
  /** Go fullscreen on the first click or key press. */
  autoFullscreen: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 70,
      sfxVolume: 75,
      muted: false,
      reduceMotion: false,
      wallpaper: DEFAULT_WALLPAPER,
      wallpaperDim: 0,
      wallpaperBlur: 0,
      theme: DEFAULT_THEME,
      musicTrack: "aurora",
      autoFullscreen: true,
      set: (patch) => set(patch),
    }),
    {
      name: "pcf.settings",
      version: 3,
      migrate: (state, from) => {
        const s = state as Partial<SettingsState>;
        if (from < 2) {
          if (s.musicVolume === 40) s.musicVolume = 70;
          if (s.sfxVolume === 60) s.sfxVolume = 75;
        }
        if (from < 3) {
          s.theme = s.theme ?? DEFAULT_THEME;
          s.musicTrack = "aurora";
          s.autoFullscreen = s.autoFullscreen ?? true;
        }
        return s as SettingsState;
      },
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
