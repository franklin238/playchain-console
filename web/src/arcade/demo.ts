// Demo arcade: a simulated PlayChainArcade that lives in this browser, so anyone
// can try listing, voting and the wallet flow with test $WIF before the contract is deployed.
// Same rules as the contract: listing burns the whole fee, votes split 50/40/10, a developer's
// vote on their own game burns the developer share too, and each UTC day's most-voted game is
// the next day's Spotlight. Nothing here touches a real wallet or chain.

import { readJson, writeJson } from "../lib/storage";
import { LOCAL_SLUGS, localMetaUrl } from "../games/meta";
import { splitLocal } from "./logic";

export const DEMO_WALLET = "0xde30000000000000000000000000000000c0ffee" as const;
const ONE = 10n ** 18n;
const KEY = "pcf.demo.v1";
const DAY = 86_400;

export const DEMO_PARAMS = {
  listingFee: 100n * ONE,
  minVote: 100n * ONE,
  burnBps: 5000,
  devBps: 4000,
  treasuryBps: 1000,
  treasury: "0x7ea5000000000000000000000000000000000001" as `0x${string}`,
  paused: false,
};

export interface DemoGame {
  id: number;
  uri: string;
  developer: `0x${string}`;
  listedAt: number;
}

export interface DemoEvent {
  kind: "vote" | "list";
  id: number;
  who: `0x${string}`;
  amount: bigint;
  burned: bigint;
  toDev: bigint;
  toTreasury: bigint;
  epoch: bigint;
  /** unix seconds */
  time: number;
  block: bigint;
  tx: `0x${string}`;
}

interface DemoChain {
  games: DemoGame[];
  events: DemoEvent[];
  balance: bigint;
  allowance: bigint;
  block: bigint;
}

// Developer wallets for the bundled games, and the other "players" who vote in the demo.
const DEVS: `0x${string}`[] = [
  "0x5eeb0000000000000000000000000000000a11ce",
  "0x5eeb0000000000000000000000000000000b0b00",
  "0x5eeb0000000000000000000000000000000ca7e0",
];
const VOTERS: `0x${string}`[] = [
  "0x1a7e000000000000000000000000000000000f01",
  "0x2b8f000000000000000000000000000000000f02",
  "0x3c90000000000000000000000000000000000f03",
  "0x4da1000000000000000000000000000000000f04",
  "0x5eb2000000000000000000000000000000000f05",
  "0x6fc3000000000000000000000000000000000f06",
  "0x70d4000000000000000000000000000000000f07",
  "0x81e5000000000000000000000000000000000f08",
];

export const nowSec = () => Math.floor(Date.now() / 1000);
export const epochOf = (t: number) => BigInt(Math.floor(t / DAY));
export const epochEnds = (e: bigint) => Number(e + 1n) * DAY;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fakeHash(r: () => number): `0x${string}` {
  let h = "0x";
  for (let i = 0; i < 64; i++) h += Math.floor(r() * 16).toString(16);
  return h as `0x${string}`;
}

let chain: DemoChain | null = null;

function save() {
  if (!chain) return;
  writeJson(KEY, {
    games: chain.games,
    events: chain.events.map((e) => ({ ...e, amount: String(e.amount), burned: String(e.burned), toDev: String(e.toDev), toTreasury: String(e.toTreasury), epoch: String(e.epoch), block: String(e.block) })),
    balance: String(chain.balance),
    allowance: String(chain.allowance),
    block: String(chain.block),
  });
}

/** Sites this console used to live at. A demo saved there points its built-in games at the old
 * address, which isn't on this site's play allowlist, so move them to this site's own copy. */
const OLD_ORIGINS = ["https://playchain-flat.vercel.app"];

function fixOldUri(g: DemoGame): DemoGame {
  try {
    const u = new URL(g.uri);
    const slug = /^\/games\/([^/]+)\/meta\.json$/.exec(u.pathname)?.[1];
    if (OLD_ORIGINS.includes(u.origin) && slug && (LOCAL_SLUGS as readonly string[]).includes(slug)) return { ...g, uri: localMetaUrl(slug) };
  } catch {
    /* not a URL: leave it as it is */
  }
  return g;
}

function load(): DemoChain | null {
  const raw = readJson<Record<string, unknown> | null>(KEY, null);
  if (!raw || !Array.isArray(raw.games) || !Array.isArray(raw.events)) return null;
  try {
    return {
      games: (raw.games as DemoGame[]).map(fixOldUri),
      events: (raw.events as Record<string, string | number>[]).map((e) => ({
        kind: e.kind as "vote" | "list",
        id: Number(e.id),
        who: e.who as `0x${string}`,
        amount: BigInt(e.amount),
        burned: BigInt(e.burned),
        toDev: BigInt(e.toDev),
        toTreasury: BigInt(e.toTreasury),
        epoch: BigInt(e.epoch),
        time: Number(e.time),
        block: BigInt(e.block),
        tx: e.tx as `0x${string}`,
      })),
      balance: BigInt(String(raw.balance)),
      allowance: BigInt(String(raw.allowance ?? "0")),
      block: BigInt(String(raw.block ?? "1")),
    };
  } catch {
    return null;
  }
}

function pushVote(c: DemoChain, who: `0x${string}`, id: number, amount: bigint, time: number, r: () => number): DemoEvent {
  const g = c.games.find((x) => x.id === id)!;
  const s = splitLocal(amount, DEMO_PARAMS.devBps, DEMO_PARAMS.treasuryBps, who.toLowerCase() === g.developer.toLowerCase());
  const ev: DemoEvent = { kind: "vote", id, who, amount, ...s, epoch: epochOf(time), time, block: ++c.block, tx: fakeHash(r) };
  c.events.push(ev);
  return ev;
}

/** Three days of plausible history so the Live Race, Spotlight and feed have something to show. */
function seed(): DemoChain {
  const r = rng(0x5eed);
  const now = nowSec(), today = epochOf(now);
  const c: DemoChain = { games: [], events: [], balance: 5000n * ONE, allowance: 0n, block: 1000n };
  const start = Number(today - 3n) * DAY + 3600;
  LOCAL_SLUGS.forEach((slug, i) => {
    const g: DemoGame = { id: i + 1, uri: localMetaUrl(slug), developer: DEVS[i % DEVS.length], listedAt: start + i * 900 };
    c.games.push(g);
    c.events.push({ kind: "list", id: g.id, who: g.developer, amount: 0n, burned: DEMO_PARAMS.listingFee, toDev: 0n, toTreasury: 0n, epoch: epochOf(g.listedAt), time: g.listedAt, block: ++c.block, tx: fakeHash(r) });
  });
  for (let d = 3; d >= 0; d--) {
    const day = Number(today) - d, from = day * DAY + 4 * 3600, to = d === 0 ? now - 120 : (day + 1) * DAY - 600;
    const n = d === 0 ? 5 : 8 + Math.floor(r() * 5);
    const favourite = 1 + ((day * 7) % c.games.length);
    for (let i = 0; i < n && to > from; i++) {
      const id = r() < 0.45 ? favourite : 1 + Math.floor(r() * c.games.length);
      const amount = BigInt(100 + Math.floor(r() * 8) * 50) * ONE;
      pushVote(c, VOTERS[Math.floor(r() * VOTERS.length)], id, amount, Math.floor(from + ((to - from) * (i + r())) / n), r);
    }
  }
  c.events.sort((a, b) => a.time - b.time);
  return c;
}

/** A demo saved before a game shipped with this site doesn't have it yet, so list it now. */
function addNewGames(c: DemoChain): boolean {
  const have = new Set(c.games.map((g) => g.uri));
  const r = rng(c.games.length * 7919 + 1);
  let added = false;
  for (const slug of LOCAL_SLUGS) {
    const uri = localMetaUrl(slug);
    if (have.has(uri)) continue;
    const id = Math.max(0, ...c.games.map((g) => g.id)) + 1;
    const g: DemoGame = { id, uri, developer: DEVS[(id - 1) % DEVS.length], listedAt: nowSec() - 60 };
    c.games.push(g);
    c.events.push({ kind: "list", id, who: g.developer, amount: 0n, burned: DEMO_PARAMS.listingFee, toDev: 0n, toTreasury: 0n, epoch: epochOf(g.listedAt), time: g.listedAt, block: ++c.block, tx: fakeHash(r) });
    added = true;
  }
  return added;
}

export function demoChain(): DemoChain {
  if (!chain) {
    const saved = load();
    chain = saved ?? seed();
    if (saved && addNewGames(chain)) save();
  }
  return chain;
}

export function resetDemo(): void {
  chain = seed();
  save();
}

// ---- reads the store needs ----
export function votesIn(epoch: bigint, id: number): bigint {
  let v = 0n;
  for (const e of demoChain().events) if (e.kind === "vote" && e.epoch === epoch && e.id === id) v += e.amount;
  return v;
}
export function totalVotes(id: number): bigint {
  let v = 0n;
  for (const e of demoChain().events) if (e.kind === "vote" && e.id === id) v += e.amount;
  return v;
}
/** Leader of an epoch: most votes, ties to the game that reached that total first (0 = no votes). */
export function leaderOf(epoch: bigint): number {
  const tally = new Map<number, bigint>();
  let leader = 0, top = 0n;
  for (const e of demoChain().events) {
    if (e.kind !== "vote" || e.epoch !== epoch) continue;
    const v = (tally.get(e.id) ?? 0n) + e.amount;
    tally.set(e.id, v);
    if (v > top) { top = v; leader = e.id; }
  }
  return leader;
}
export function demoBalance(): bigint {
  return demoChain().balance;
}

// ---- writes (what the wallet would sign) ----
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoApprove(amount: bigint): Promise<`0x${string}`> {
  await wait(700);
  const c = demoChain();
  c.allowance = amount; c.block++;
  save();
  return fakeHash(rng(Number(c.block)));
}

export async function demoVote(id: number, amount: bigint): Promise<`0x${string}`> {
  await wait(1000);
  const c = demoChain();
  if (amount < DEMO_PARAMS.minVote) throw new Error(`The minimum vote is ${DEMO_PARAMS.minVote / ONE} WIF.`);
  if (amount > c.balance) throw new Error("Not enough test $WIF. Use the faucet in the wallet sheet.");
  if (amount > c.allowance) throw new Error("Approve the amount first.");
  if (!c.games.some((g) => g.id === id)) throw new Error("That game isn't listed.");
  c.balance -= amount; c.allowance -= amount;
  const ev = pushVote(c, DEMO_WALLET, id, amount, nowSec(), rng(Number(c.block) * 31));
  save();
  return ev.tx;
}

export async function demoList(uri: string): Promise<`0x${string}`> {
  await wait(1000);
  const c = demoChain();
  if (DEMO_PARAMS.listingFee > c.balance) throw new Error("Not enough test $WIF to list. Use the faucet in the wallet sheet.");
  if (DEMO_PARAMS.listingFee > c.allowance) throw new Error("Approve the listing fee first.");
  c.balance -= DEMO_PARAMS.listingFee; c.allowance -= DEMO_PARAMS.listingFee;
  const g: DemoGame = { id: c.games.length + 1, uri, developer: DEMO_WALLET, listedAt: nowSec() };
  c.games.push(g);
  const tx = fakeHash(rng(Number(c.block) * 17));
  c.events.push({ kind: "list", id: g.id, who: DEMO_WALLET, amount: 0n, burned: DEMO_PARAMS.listingFee, toDev: 0n, toTreasury: 0n, epoch: epochOf(g.listedAt), time: g.listedAt, block: ++c.block, tx });
  save();
  return tx;
}

/** Top up the demo wallet. */
export function demoFaucet(): void {
  const c = demoChain();
  c.balance += 5000n * ONE;
  save();
}

/** Another player votes now and then, so the Live Race and feed move while you watch. */
export function demoBackgroundVote(): boolean {
  const c = demoChain(), r = rng(Date.now() & 0xffffffff);
  if (!c.games.length) return false;
  const id = c.games[Math.floor(r() * c.games.length)].id;
  pushVote(c, VOTERS[Math.floor(r() * VOTERS.length)], id, BigInt(100 + Math.floor(r() * 6) * 50) * ONE, nowSec(), r);
  save();
  return true;
}

export function isDemoTx(hash: string): boolean {
  return demoChain().events.some((e) => e.tx === hash);
}
