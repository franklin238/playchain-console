import { create } from "zustand";
import { playSfx } from "../audio/engine";

/** Which bottom sheet is open: the wallet picker, or the vote sheet for a game. */
interface SheetsState {
  wallet: boolean;
  voteKey: string | null;
  /** Shown after leaving a game: "Did you enjoy it? Vote with $WIF". */
  afterPlayKey: string | null;
  openWallet: () => void;
  closeWallet: () => void;
  openVote: (key: string) => void;
  closeVote: () => void;
  setAfterPlay: (key: string | null) => void;
}

export const useSheets = create<SheetsState>()((set) => ({
  wallet: false,
  voteKey: null,
  afterPlayKey: null,
  openWallet: () => { playSfx("open"); set({ wallet: true }); },
  closeWallet: () => { playSfx("close"); set({ wallet: false }); },
  openVote: (key) => { playSfx("open"); set({ voteKey: key, afterPlayKey: null }); },
  closeVote: () => { playSfx("close"); set({ voteKey: null }); },
  setAfterPlay: (afterPlayKey) => set({ afterPlayKey }),
}));
