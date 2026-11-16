// The player's own progress, kept in this browser: plays, best scores per game, votes and
// console achievements. Nothing here is onchain or shared, so it is a personal record, not a
// global leaderboard (a game in a sandboxed frame could report any score it liked).
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LOCAL_SLUGS } from "../games/meta";
import { safeLocalStorage } from "../lib/storage";
import { useSettings } from "./settings";
import { useUi } from "./ui";
import type { IconName } from "../components/Icon";

/** One play session's best score in a game. */
export interface Run {
  score: number;
  at: number;
  session: string;
}

interface ProgressData {
  plays: Record<string, number>;
  runs: Record<string, Run[]>;
  voteCount: number;
  /** Whole WIF voted, all time. */
  voteTotal: number;
  /** UTC days (days since 1970) with at least one vote. */
  voteDays: number[];
  listed: number;
  styled: boolean;
  shared: boolean;
  nightOwl: boolean;
  kingmaker: boolean;
  /** Beat an earlier best score in some game. */
  newBest: boolean;
  /** Achievement id -> when it was unlocked. */
  unlocked: Record<string, number>;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  /** [have, need] for achievements with a count, so the page can show a bar. */
  progress?: (p: ProgressData) => [number, number];
  done: (p: ProgressData) => boolean;
}

const totalPlays = (p: ProgressData) => Object.values(p.plays).reduce((a, n) => a + n, 0);
const gamesPlayed = (p: ProgressData) => LOCAL_SLUGS.filter((s) => (p.plays[s] ?? 0) > 0).length;

/** Longest run of consecutive days in a sorted-or-not list of day numbers. */
export function longestStreak(days: number[]): number {
  const d = [...new Set(days)].sort((a, b) => a - b);
  let best = 0, run = 0;
  for (let i = 0; i < d.length; i++) {
    run = i > 0 && d[i] === d[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "power-on", title: "Power on", desc: "Play any game.", icon: "play", done: (p) => totalPlays(p) > 0 },
  {
    id: "full-shelf",
    title: "Full shelf",
    desc: `Play all ${LOCAL_SLUGS.length} PlayChain games.`,
    icon: "library",
    progress: (p) => [gamesPlayed(p), LOCAL_SLUGS.length],
    done: (p) => gamesPlayed(p) >= LOCAL_SLUGS.length,
  },
  { id: "regular", title: "Regular", desc: "Start 10 games.", icon: "gamepad", progress: (p) => [Math.min(totalPlays(p), 10), 10], done: (p) => totalPlays(p) >= 10 },
  { id: "on-the-board", title: "On the board", desc: "Set your first high score.", icon: "trophy", done: (p) => Object.values(p.runs).some((r) => r.length > 0) },
  { id: "beat-yourself", title: "Beat yourself", desc: "Beat your own best score in any game.", icon: "trophy", done: (p) => p.newBest },
  { id: "night-owl", title: "Night owl", desc: "Play between midnight and 5 am.", icon: "clock", done: (p) => p.nightOwl },
  { id: "first-ballot", title: "First ballot", desc: "Cast your first $WIF vote.", icon: "check", done: (p) => p.voteCount > 0 },
  { id: "whale-watch", title: "Whale watch", desc: "Vote 1,000 $WIF in total.", icon: "wallet", progress: (p) => [Math.min(Math.floor(p.voteTotal), 1000), 1000], done: (p) => p.voteTotal >= 1000 },
  { id: "kingmaker", title: "Kingmaker", desc: "Vote a game into first place for the day.", icon: "trophy", done: (p) => p.kingmaker },
  { id: "streak", title: "Three in a row", desc: "Vote on three days in a row.", icon: "clock", progress: (p) => [Math.min(longestStreak(p.voteDays), 3), 3], done: (p) => longestStreak(p.voteDays) >= 3 },
  { id: "make-it-yours", title: "Make it yours", desc: "Change the theme, background or menu music.", icon: "settings", done: (p) => p.styled },
  { id: "spread-the-word", title: "Spread the word", desc: "Share a vote on X or save its card.", icon: "send", done: (p) => p.shared },
  { id: "game-maker", title: "Game maker", desc: "List your own game on PlayChain.", icon: "upload", done: (p) => p.listed > 0 },
];

interface ProgressState extends ProgressData {
  recordPlay: (slug: string) => void;
  recordScore: (slug: string, session: string, score: number) => void;
  recordVote: (wif: number) => void;
  recordKingmaker: () => void;
  recordListing: () => void;
  recordShare: () => void;
  recordStyle: () => void;
}

const EMPTY: ProgressData = {
  plays: {},
  runs: {},
  voteCount: 0,
  voteTotal: 0,
  voteDays: [],
  listed: 0,
  styled: false,
  shared: false,
  nightOwl: false,
  kingmaker: false,
  newBest: false,
  unlocked: {},
};

const today = () => Math.floor(Date.now() / 86_400_000);

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      /** Apply a change, then unlock (and announce) whatever it completed. */
      const update = (patch: Partial<ProgressData>) => {
        const next = { ...get(), ...patch };
        const fresh = ACHIEVEMENTS.filter((a) => !next.unlocked[a.id] && a.done(next));
        if (fresh.length) {
          const now = Date.now();
          next.unlocked = { ...next.unlocked, ...Object.fromEntries(fresh.map((a) => [a.id, now])) };
        }
        set({ ...patch, unlocked: next.unlocked });
        fresh.forEach((a, i) =>
          window.setTimeout(() => useUi.getState().toast({ title: `Achievement unlocked: ${a.title}`, body: a.desc, tone: "achievement" }), 400 + i * 900),
        );
      };
      return {
        ...EMPTY,
        recordPlay: (slug) => {
          const h = new Date().getHours();
          update({ plays: { ...get().plays, [slug]: (get().plays[slug] ?? 0) + 1 }, nightOwl: get().nightOwl || h < 5 });
        },
        recordScore: (slug, session, score) => {
          if (!slug || !Number.isFinite(score) || score <= 0) return;
          const runs = [...(get().runs[slug] ?? [])];
          const others = runs.filter((r) => r.session !== session);
          const prevBest = others.reduce((m, r) => Math.max(m, r.score), 0);
          const mine = runs.find((r) => r.session === session);
          if (mine && score <= mine.score) return;
          const list = [...others, { score, at: Date.now(), session }].sort((a, b) => b.score - a.score).slice(0, 10);
          update({ runs: { ...get().runs, [slug]: list }, newBest: get().newBest || (prevBest > 0 && score > prevBest) });
        },
        recordVote: (wif) =>
          update({ voteCount: get().voteCount + 1, voteTotal: get().voteTotal + wif, voteDays: [...new Set([...get().voteDays, today()])].slice(-60) }),
        recordKingmaker: () => !get().kingmaker && update({ kingmaker: true }),
        recordListing: () => update({ listed: get().listed + 1 }),
        recordShare: () => !get().shared && update({ shared: true }),
        recordStyle: () => !get().styled && update({ styled: true }),
      };
    },
    {
      name: "pc.progress",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => {
        const { recordPlay: _a, recordScore: _b, recordVote: _c, recordKingmaker: _d, recordListing: _e, recordShare: _f, recordStyle: _g, ...data } = s;
        return data;
      },
    },
  ),
);

/** A game's best score in this browser, or null. */
export const bestScore = (runs: Run[] | undefined) => (runs?.length ? runs[0].score : null);

let watching = false;
/** Count a change of theme, background or menu music. Call once at start-up. */
export function watchStyleChanges(): void {
  if (watching) return;
  watching = true;
  useSettings.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.wallpaper !== prev.wallpaper || s.musicTrack !== prev.musicTrack) useProgress.getState().recordStyle();
  });
}
