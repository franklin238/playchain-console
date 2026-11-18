// USDG tips: players tip a game's developer in Paxos USDG through PlayChainTips.
// 90% goes to the developer and 10% to the treasury (read from the contract); nothing is held.

import { getConnection, writeContract } from "@wagmi/core";
import { consoleConfig } from "../config/console.config";
import { erc20Abi } from "../config/contracts";
import { CHAIN, publicClient, wagmiConfig } from "./client";

export const USDG_DECIMALS = 6;

export const tipsAbi = [
  { type: "function", name: "tip", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "totalTips", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minTip", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "treasuryBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "error", name: "TipTooSmall", inputs: [{ name: "amount", type: "uint256" }, { name: "minTip", type: "uint256" }] },
  { type: "error", name: "GameInactive", inputs: [{ name: "id", type: "uint256" }] },
] as const;

export const tipsEnabled = (): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(consoleConfig.tipsAddress) && /^0x[0-9a-fA-F]{40}$/.test(consoleConfig.usdgAddress);

const tips = () => consoleConfig.tipsAddress as `0x${string}`;
const usdg = () => consoleConfig.usdgAddress as `0x${string}`;

/** "12.5" -> 12_500_000n; null when it isn't a positive amount with at most 6 decimals. */
export function parseUsd(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const v = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0") || "0");
  return v > 0n ? v : null;
}

export function formatUsd(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const cents = (amount % 1_000_000n) / 10_000n;
  return `${whole.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
}

export interface TipInfo { total: bigint; minTip: bigint; treasuryBps: number }

export async function readTipInfo(id: bigint): Promise<TipInfo> {
  const c = publicClient();
  const [total, minTip, treasuryBps] = await Promise.all([
    c.readContract({ address: tips(), abi: tipsAbi, functionName: "totalTips", args: [id] }),
    c.readContract({ address: tips(), abi: tipsAbi, functionName: "minTip" }),
    c.readContract({ address: tips(), abi: tipsAbi, functionName: "treasuryBps" }),
  ]);
  return { total, minTip, treasuryBps: Number(treasuryBps) };
}

export async function usdgBalance(owner: `0x${string}`): Promise<bigint> {
  return publicClient().readContract({ address: usdg(), abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

async function confirm(hash: `0x${string}`) {
  const r = await publicClient().waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error("The transaction reverted onchain.");
}

/** Approve exactly `amount` USDG (if needed), then tip. `onStep` reports progress for the UI. */
export async function sendTip(id: bigint, amount: bigint, onStep: (s: "approving" | "tipping") => void): Promise<`0x${string}`> {
  const conn = getConnection(wagmiConfig());
  if (conn.status !== "connected") throw new Error("Connect a wallet first.");
  if (conn.chainId !== CHAIN.id) throw new Error(`Switch your wallet to ${CHAIN.name}.`);
  const owner = conn.address;
  if ((await usdgBalance(owner)) < amount) throw new Error("Not enough USDG in this wallet.");
  const c = publicClient();
  const allowed = await c.readContract({ address: usdg(), abi: erc20Abi, functionName: "allowance", args: [owner, tips()] });
  if (allowed < amount) {
    onStep("approving");
    const h = await writeContract(wagmiConfig(), { address: usdg(), abi: erc20Abi, functionName: "approve", args: [tips(), amount], chainId: CHAIN.id, account: owner });
    await confirm(h);
  }
  onStep("tipping");
  await c.simulateContract({ address: tips(), abi: tipsAbi, functionName: "tip", args: [id, amount], account: owner });
  const hash = await writeContract(wagmiConfig(), { address: tips(), abi: tipsAbi, functionName: "tip", args: [id, amount], chainId: CHAIN.id, account: owner });
  await confirm(hash);
  return hash;
}
