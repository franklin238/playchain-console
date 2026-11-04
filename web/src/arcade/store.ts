// Onchain state of the arcade: listed games, epoch, Spotlight, Live Race, prices.
// Refreshes every 15 seconds and after each confirmed transaction.

import { create } from "zustand";
import { consoleConfig } from "../config/console.config";
import { arcadeAbi } from "../config/contracts";
import { fetchMeta, LOCAL_SLUGS, localMetaUrl, type GameMeta } from "../games/meta";
import { arcadeDeployed, publicClient } from "../web3/client";
import { wifBalance, wifDecimals } from "../web3/tokens";
import { useWallet } from "../web3/wallet";
import { liveRace, pickSpotlight, spotlightEpochs, type ChainGame, type RaceRow } from "./logic";

export interface GameEntry {
  /** Route key: the onchain id, or "local-<slug>" in preview mode. */
  key: string;
  id: number | null;
  developer: `0x${string}` | null;
  active: boolean;
  listedAt: number;
  totalVotes: bigint;
  epochVotes: bigint;
  uri: string;
  meta: GameMeta | null;
  metaErrors: string[];
}

export interface ArcadeParams {
  listingFee: bigint;
  minVote: bigint;
  burnBps: number;
  devBps: number;
  treasuryBps: number;
  treasury: `0x${string}`;
  paused: boolean;
}

interface ArcadeState {
  mode: "loading" | "live" | "preview";
  games: GameEntry[];
  epoch: bigint;
  epochEndsAt: number;
  spotlight: { key: string; epoch: bigint | null; votes: bigint } | null;
  race: RaceRow[];
  epochTotal: bigint;
  params: ArcadeParams | null;
  decimals: number;
  balance: bigint | null;
  error: string | null;
  updatedAt: number;
}

export const useArcade = create<ArcadeState>()(() => ({
  mode: "loading",
  games: [],
  epoch: 0n,
  epochEndsAt: 0,
  spotlight: null,
  race: [],
  epochTotal: 0n,
  params: null,
  decimals: 18,
  balance: null,
  error: null,
  updatedAt: 0,
}));

const PAGE = 100n;

async function loadMetas(entries: GameEntry[]): Promise<GameEntry[]> {
  return Promise.all(
    entries.map(async (g) => {
      const check = await fetchMeta(g.uri);
      return { ...g, meta: check.meta ?? null, metaErrors: check.errors };
    }),
  );
}

async function refreshPreview() {
  const entries: GameEntry[] = LOCAL_SLUGS.map((slug) => ({
    key: `local-${slug}`,
    id: null,
    developer: null,
    active: true,
    listedAt: 0,
    totalVotes: 0n,
    epochVotes: 0n,
    uri: localMetaUrl(slug),
    meta: null,
    metaErrors: [],
  }));
  const games = (await loadMetas(entries)).filter((g) => g.meta);
  useArcade.setState({
    mode: "preview",
    games,
    spotlight: games[0] ? { key: games[0].key, epoch: null, votes: 0n } : null,
    race: [],
    error: null,
    updatedAt: Date.now(),
  });
}

async function refreshLive() {
  const client = publicClient();
  const address = consoleConfig.arcadeAddress as `0x${string}`;
  const c = { address, abi: arcadeAbi } as const;

  const [count, epoch, listingFee, minVote, burnBps, devBps, treasuryBps, treasury, paused, decimals] = await Promise.all([
    client.readContract({ ...c, functionName: "gameCount" }),
    client.readContract({ ...c, functionName: "currentEpoch" }),
    client.readContract({ ...c, functionName: "listingFee" }),
    client.readContract({ ...c, functionName: "minVote" }),
    client.readContract({ ...c, functionName: "burnBps" }),
    client.readContract({ ...c, functionName: "devBps" }),
    client.readContract({ ...c, functionName: "treasuryBps" }),
    client.readContract({ ...c, functionName: "treasury" }),
    client.readContract({ ...c, functionName: "paused" }),
    wifDecimals(),
  ]);

  const raw: ChainGame[] = [];
  for (let offset = 0n; offset < count; offset += PAGE) {
    const page = await client.readContract({ ...c, functionName: "getGames", args: [offset, PAGE] });
    page.forEach((g, i) =>
      raw.push({
        id: Number(offset) + i + 1,
        developer: g.developer,
        listedAt: Number(g.listedAt),
        active: g.active,
        totalVotes: g.totalVotes,
        metadataURI: g.metadataURI,
      }),
    );
  }

  const ids = raw.map((g) => BigInt(g.id));
  const lookback = spotlightEpochs(epoch, consoleConfig.spotlightLookback);
  const [epochVotes, endsAt, leaders, currentLeader, epochTotal] = await Promise.all([
    ids.length ? client.readContract({ ...c, functionName: "getEpochVotes", args: [epoch, ids] }) : Promise.resolve([] as readonly bigint[]),
    client.readContract({ ...c, functionName: "epochEndsAt", args: [epoch] }),
    Promise.all(lookback.map((e) => client.readContract({ ...c, functionName: "leaderOf", args: [e] }))),
    client.readContract({ ...c, functionName: "leaderOf", args: [epoch] }),
    client.readContract({ ...c, functionName: "totalVotesInEpoch", args: [epoch] }),
  ]);

  // Reuse metadata already loaded for an unchanged URI.
  const prev = new Map(useArcade.getState().games.map((g) => [g.key, g]));
  let entries: GameEntry[] = raw.map((g, i) => {
    const old = prev.get(String(g.id));
    return {
      key: String(g.id),
      id: g.id,
      developer: g.developer,
      active: g.active,
      listedAt: g.listedAt,
      totalVotes: g.totalVotes,
      epochVotes: epochVotes[i] ?? 0n,
      uri: g.metadataURI,
      meta: old && old.uri === g.metadataURI ? old.meta : null,
      metaErrors: old && old.uri === g.metadataURI ? old.metaErrors : [],
    };
  });
  entries = await loadMetas(entries);

  const shown = entries.filter((g) => g.active && g.meta);
  const pick = pickSpotlight(
    lookback,
    leaders,
    shown.map((g) => ({ id: g.id!, active: true })),
  );
  const spotEntry = pick ? entries.find((g) => g.id === pick.id) : undefined;
  let spotVotes = 0n;
  if (pick?.epoch != null) {
    spotVotes = await client.readContract({ ...c, functionName: "votesInEpoch", args: [pick.epoch, BigInt(pick.id)] });
  }

  const shownIds = new Set(shown.map((g) => g.id!));
  const race = liveRace(
    raw.filter((g) => shownIds.has(g.id)).map((g) => g.id),
    raw.filter((g) => shownIds.has(g.id)).map((g) => entries.find((e) => e.id === g.id)!.epochVotes),
    Number(currentLeader),
  );

  useArcade.setState({
    mode: "live",
    games: entries,
    epoch,
    epochEndsAt: Number(endsAt),
    spotlight: spotEntry ? { key: spotEntry.key, epoch: pick!.epoch, votes: spotVotes } : null,
    race,
    epochTotal,
    params: {
      listingFee,
      minVote,
      burnBps: Number(burnBps),
      devBps: Number(devBps),
      treasuryBps: Number(treasuryBps),
      treasury,
      paused,
    },
    decimals,
    error: null,
    updatedAt: Date.now(),
  });
}

let inflight: Promise<void> | null = null;

export function refreshArcade(): Promise<void> {
  inflight ??= (async () => {
    try {
      if (arcadeDeployed()) await refreshLive();
      else await refreshPreview();
      await refreshBalance();
    } catch (err) {
      useArcade.setState({
        error: err instanceof Error ? err.message.split("\n")[0] : "Could not reach Robinhood Chain.",
        mode: useArcade.getState().mode === "loading" ? "preview" : useArcade.getState().mode,
      });
      if (useArcade.getState().games.length === 0) await refreshPreview().catch(() => {});
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function refreshBalance(): Promise<void> {
  const { address, status } = useWallet.getState();
  if (status !== "connected" || !address) {
    useArcade.setState({ balance: null });
    return;
  }
  try {
    useArcade.setState({ balance: await wifBalance(address) });
  } catch {
    // keep the last known balance
  }
}

let timer: number | null = null;

export function startArcadePolling(): () => void {
  void refreshArcade();
  timer ??= window.setInterval(() => {
    if (!document.hidden) void refreshArcade();
  }, consoleConfig.refreshMs);
  const unsub = useWallet.subscribe((s, p) => {
    if (s.address !== p.address || s.status !== p.status) void refreshBalance();
  });
  return () => {
    if (timer) window.clearInterval(timer);
    timer = null;
    unsub();
  };
}

export function useEntry(key: string | undefined): GameEntry | undefined {
  return useArcade((s) => s.games.find((g) => g.key === key));
}

/** Games for the shelf: active, valid metadata. */
export function shelfGames(games: GameEntry[]): GameEntry[] {
  return games.filter((g) => g.active && g.meta);
}
