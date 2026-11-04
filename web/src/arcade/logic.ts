// Pure helpers for the Spotlight and Live Race. No network, so they are unit tested.

export interface ChainGame {
  id: number;
  developer: `0x${string}`;
  listedAt: number;
  active: boolean;
  totalVotes: bigint;
  metadataURI: string;
}

/** Epochs to check for the Spotlight, newest first: current-1 down to current-lookback (never below 0). */
export function spotlightEpochs(current: bigint, lookback: number): bigint[] {
  const out: bigint[] = [];
  for (let e = current - 1n; e >= 0n && out.length < lookback; e--) out.push(e);
  return out;
}

export interface SpotlightPick {
  id: number;
  /** Epoch whose leader it is, or null when no epoch had votes (newest game fallback). */
  epoch: bigint | null;
}

/**
 * The previous epoch's leader is the Spotlight. Epochs with no votes are
 * skipped, up to the lookback. Hidden games are skipped too. If nothing is
 * found, the newest active game is shown.
 */
export function pickSpotlight(
  epochs: bigint[],
  leaders: (number | bigint)[],
  games: Pick<ChainGame, "id" | "active">[],
): SpotlightPick | null {
  const active = new Set(games.filter((g) => g.active).map((g) => g.id));
  for (let i = 0; i < epochs.length; i++) {
    const id = Number(leaders[i] ?? 0);
    if (id > 0 && active.has(id)) return { id, epoch: epochs[i] };
  }
  const newest = [...games].filter((g) => g.active).sort((a, b) => b.id - a.id)[0];
  return newest ? { id: newest.id, epoch: null } : null;
}

export interface RaceRow {
  id: number;
  votes: bigint;
}

/**
 * Current-epoch ranking, highest first. Ties keep the contract's rule: the
 * contract's leader (first to reach the top total) is ranked first, then by id.
 */
export function liveRace(ids: number[], votes: bigint[], leaderId: number, limit = 5): RaceRow[] {
  const rows = ids.map((id, i) => ({ id, votes: votes[i] ?? 0n })).filter((r) => r.votes > 0n);
  rows.sort((a, b) => {
    if (a.votes !== b.votes) return a.votes > b.votes ? -1 : 1;
    if (a.id === leaderId) return -1;
    if (b.id === leaderId) return 1;
    return a.id - b.id;
  });
  return rows.slice(0, limit);
}

/** Same split as the contract's _split, for display when previewSplit can't be called. */
export function splitLocal(
  amount: bigint,
  devBps: number,
  treasuryBps: number,
  selfVote: boolean,
): { burned: bigint; toDev: bigint; toTreasury: bigint } {
  let toDev = (amount * BigInt(devBps)) / 10_000n;
  const toTreasury = (amount * BigInt(treasuryBps)) / 10_000n;
  if (selfVote) toDev = 0n;
  return { burned: amount - toDev - toTreasury, toDev, toTreasury };
}

/** "3h 12m" until the epoch ends. */
export function countdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
