// Every transaction the console sends. Approvals are always for the exact amount.

import { getConnection, writeContract } from "@wagmi/core";
import { consoleConfig } from "../config/console.config";
import { arcadeAbi, erc20Abi } from "../config/contracts";
import { DEMO_WALLET, demoApprove, demoList, demoVote } from "../arcade/demo";
import { CHAIN, publicClient, wagmiConfig } from "./client";
import { useWallet } from "./wallet";

/** No contract yet: approvals, votes and listings go to the demo arcade in this browser. */
function demo(): boolean {
  if (consoleConfig.arcadeAddress) return false;
  if (useWallet.getState().address !== DEMO_WALLET) throw new Error("Use the demo wallet: this is a demo with test $WIF.");
  return true;
}

export type TxStep = "idle" | "approving" | "approved" | "sending" | "done" | "error";

function arcade(): `0x${string}` {
  if (!consoleConfig.arcadeAddress) throw new Error("The arcade contract isn't deployed yet.");
  return consoleConfig.arcadeAddress;
}

function account(): `0x${string}` {
  const conn = getConnection(wagmiConfig());
  if (conn.status !== "connected") throw new Error("Connect a wallet first.");
  if (conn.chainId !== CHAIN.id) throw new Error("Switch your wallet to Robinhood Chain (chain does not match).");
  return conn.address;
}

async function confirm(hash: `0x${string}`) {
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("The transaction reverted onchain.");
  return receipt;
}

export async function allowance(owner: `0x${string}`): Promise<bigint> {
  return publicClient().readContract({
    address: consoleConfig.wifAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, arcade()],
  });
}

/** Approve exactly `amount` unless the current allowance already covers it. Returns the tx hash, or null if skipped. */
export async function approveExact(amount: bigint, onHash?: (h: `0x${string}`) => void): Promise<`0x${string}` | null> {
  if (demo()) { const h = await demoApprove(amount); onHash?.(h); return h; }
  const owner = account();
  if ((await allowance(owner)) >= amount) return null;
  const hash = await writeContract(wagmiConfig(), {
    address: consoleConfig.wifAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [arcade(), amount],
    chainId: CHAIN.id,
    account: owner,
  });
  onHash?.(hash);
  await confirm(hash);
  return hash;
}

export async function sendVote(id: bigint, amount: bigint, onHash?: (h: `0x${string}`) => void): Promise<`0x${string}`> {
  if (demo()) { const h = await demoVote(Number(id), amount); onHash?.(h); return h; }
  const owner = account();
  // Simulate first so a revert reason shows before the wallet pops up.
  await publicClient().simulateContract({ address: arcade(), abi: arcadeAbi, functionName: "vote", args: [id, amount], account: owner });
  const hash = await writeContract(wagmiConfig(), {
    address: arcade(),
    abi: arcadeAbi,
    functionName: "vote",
    args: [id, amount],
    chainId: CHAIN.id,
    account: owner,
  });
  onHash?.(hash);
  await confirm(hash);
  return hash;
}

export async function sendListGame(uri: string, onHash?: (h: `0x${string}`) => void): Promise<`0x${string}`> {
  if (demo()) { const h = await demoList(uri); onHash?.(h); return h; }
  const owner = account();
  await publicClient().simulateContract({ address: arcade(), abi: arcadeAbi, functionName: "listGame", args: [uri], account: owner });
  const hash = await writeContract(wagmiConfig(), {
    address: arcade(),
    abi: arcadeAbi,
    functionName: "listGame",
    args: [uri],
    chainId: CHAIN.id,
    account: owner,
  });
  onHash?.(hash);
  await confirm(hash);
  return hash;
}

export async function sendUpdateGame(id: bigint, uri: string, onHash?: (h: `0x${string}`) => void): Promise<`0x${string}`> {
  const owner = account();
  await publicClient().simulateContract({ address: arcade(), abi: arcadeAbi, functionName: "updateGame", args: [id, uri], account: owner });
  const hash = await writeContract(wagmiConfig(), {
    address: arcade(),
    abi: arcadeAbi,
    functionName: "updateGame",
    args: [id, uri],
    chainId: CHAIN.id,
    account: owner,
  });
  onHash?.(hash);
  await confirm(hash);
  return hash;
}
