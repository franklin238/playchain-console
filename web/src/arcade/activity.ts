// Live feed of votes and listings, read from contract events since the deploy block.

import { parseAbiItem, type Log } from "viem";
import { create } from "zustand";
import { consoleConfig } from "../config/console.config";
import { arcadeDeployed, publicClient } from "../web3/client";
import { demoChain } from "./demo";

const VOTED = parseAbiItem(
  "event Voted(uint256 indexed epoch, uint256 indexed id, address indexed voter, uint256 amount, uint256 burned, uint256 toDev, uint256 toTreasury)",
);
const LISTED = parseAbiItem("event GameListed(uint256 indexed id, address indexed developer, string uri, uint256 feeBurned)");

export type ActivityRow =
  | {
      kind: "vote";
      key: string;
      block: bigint;
      tx: `0x${string}`;
      gameId: number;
      who: `0x${string}`;
      amount: bigint;
      burned: bigint;
      toDev: bigint;
      toTreasury: bigint;
      epoch: bigint;
      /** unix seconds, when known (demo events) */
      time?: number;
    }
  | { kind: "list"; key: string; block: bigint; tx: `0x${string}`; gameId: number; who: `0x${string}`; burned: bigint; time?: number };

interface ActivityState {
  rows: ActivityRow[];
  lastBlock: bigint;
  totals: { burned: bigint; toDevs: bigint; toTreasury: bigint; votes: number; listings: number; voters: number };
  loading: boolean;
  error: string | null;
}

const emptyTotals = { burned: 0n, toDevs: 0n, toTreasury: 0n, votes: 0, listings: 0, voters: 0 };

export const useActivity = create<ActivityState>()(() => ({
  rows: [],
  lastBlock: 0n,
  totals: emptyTotals,
  loading: false,
  error: null,
}));

function keyOf(l: Log): string {
  return `${l.transactionHash}-${l.logIndex}`;
}

let busy = false;

function setRows(rows: ActivityRow[], head: bigint) {
  const totals = { ...emptyTotals };
  const voters = new Set<string>();
  for (const r of rows) {
    totals.burned += r.burned;
    if (r.kind === "vote") {
      totals.toDevs += r.toDev;
      totals.toTreasury += r.toTreasury;
      totals.votes++;
      voters.add(r.who.toLowerCase());
    } else totals.listings++;
  }
  totals.voters = voters.size;
  useActivity.setState({ rows, lastBlock: head, totals, loading: false, error: null });
}

export async function refreshActivity(): Promise<void> {
  if (!arcadeDeployed()) {
    const c = demoChain();
    const rows: ActivityRow[] = c.events
      .map((e): ActivityRow => e.kind === "vote"
        ? { kind: "vote", key: e.tx, block: e.block, tx: e.tx, gameId: e.id, who: e.who, amount: e.amount, burned: e.burned, toDev: e.toDev, toTreasury: e.toTreasury, epoch: e.epoch, time: e.time }
        : { kind: "list", key: e.tx, block: e.block, tx: e.tx, gameId: e.id, who: e.who, burned: e.burned, time: e.time })
      .sort((a, b) => (a.block > b.block ? -1 : 1));
    setRows(rows, c.block);
    return;
  }
  if (busy) return;
  busy = true;
  useActivity.setState({ loading: true });
  try {
    const client = publicClient();
    const address = consoleConfig.arcadeAddress as `0x${string}`;
    const head = await client.getBlockNumber();
    const state = useActivity.getState();
    let from = state.lastBlock > 0n ? state.lastBlock + 1n : consoleConfig.deployBlock;
    const fresh: ActivityRow[] = [];
    while (from <= head) {
      const to = from + consoleConfig.logChunk - 1n > head ? head : from + consoleConfig.logChunk - 1n;
      const [votes, lists] = await Promise.all([
        client.getLogs({ address, event: VOTED, fromBlock: from, toBlock: to }),
        client.getLogs({ address, event: LISTED, fromBlock: from, toBlock: to }),
      ]);
      for (const l of votes) {
        const a = l.args;
        fresh.push({
          kind: "vote",
          key: keyOf(l),
          block: l.blockNumber!,
          tx: l.transactionHash!,
          gameId: Number(a.id),
          who: a.voter!,
          amount: a.amount!,
          burned: a.burned!,
          toDev: a.toDev!,
          toTreasury: a.toTreasury!,
          epoch: a.epoch!,
        });
      }
      for (const l of lists) {
        const a = l.args;
        fresh.push({
          kind: "list",
          key: keyOf(l),
          block: l.blockNumber!,
          tx: l.transactionHash!,
          gameId: Number(a.id),
          who: a.developer!,
          burned: a.feeBurned!,
        });
      }
      from = to + 1n;
    }
    const seen = new Set(state.rows.map((r) => r.key));
    const rows = [...state.rows, ...fresh.filter((r) => !seen.has(r.key))].sort((a, b) =>
      a.block === b.block ? b.key.localeCompare(a.key) : a.block > b.block ? -1 : 1,
    );
    setRows(rows, head);
  } catch (err) {
    useActivity.setState({ loading: false, error: err instanceof Error ? err.message.split("\n")[0] : "Could not load activity." });
  } finally {
    busy = false;
  }
}
