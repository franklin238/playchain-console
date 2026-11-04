import { create } from "zustand";
import { idbDelete, idbGet, idbSet } from "../lib/idb";
import { prepareImage } from "../lib/images";

const CUSTOM_KEY = "wallpaper";

interface WallpaperState {
  /** Object URL of the player's own image, if they uploaded one. */
  customUrl: string | null;
  /** Cover art used by the "Game art" wallpaper (the game selected on Home). */
  artUrl: string | null;
  load: () => Promise<void>;
  setCustom: (file: File) => Promise<void>;
  removeCustom: () => Promise<void>;
  setArt: (url: string | null) => void;
}

export const useWallpaper = create<WallpaperState>()((set, get) => ({
  customUrl: null,
  artUrl: null,

  load: async () => {
    const blob = await idbGet(CUSTOM_KEY);
    if (blob) set({ customUrl: URL.createObjectURL(blob) });
  },

  setCustom: async (file: File) => {
    const blob = await prepareImage(file, 2560);
    if (!(await idbSet(CUSTOM_KEY, blob))) throw new Error("This browser would not save the image.");
    const old = get().customUrl;
    if (old) URL.revokeObjectURL(old);
    set({ customUrl: URL.createObjectURL(blob) });
  },

  removeCustom: async () => {
    await idbDelete(CUSTOM_KEY);
    const old = get().customUrl;
    if (old) URL.revokeObjectURL(old);
    set({ customUrl: null });
  },

  setArt: (artUrl) => {
    if (get().artUrl !== artUrl) set({ artUrl });
  },
}));
