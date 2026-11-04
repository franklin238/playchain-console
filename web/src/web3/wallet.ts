// Wallet connection. The console owns the wallet: games never see it.

import {
  connect,
  disconnect,
  getConnection,
  getConnectors,
  reconnect,
  switchChain,
  watchConnection,
  watchConnectors,
  type Connector,
} from "@wagmi/core";
import { create } from "zustand";
import { readJson, writeJson } from "../lib/storage";
import { CHAIN, wagmiConfig } from "./client";

export interface WalletState {
  status: "disconnected" | "connecting" | "connected";
  address: `0x${string}` | null;
  chainId: number | null;
  walletName: string | null;
  error: string | null;
}

export const useWallet = create<WalletState>()(() => ({
  status: "disconnected",
  address: null,
  chainId: null,
  walletName: null,
  error: null,
}));

export const useWrongNetwork = () => useWallet((s) => s.status === "connected" && s.chainId !== CHAIN.id);

export interface WalletOption {
  id: string;
  name: string;
  icon?: string;
}

const LAST_KEY = "pcf.lastWallet";

function connectors(): readonly Connector[] {
  const all = getConnectors(wagmiConfig());
  const announced = all.filter((c) => c.id !== "injected");
  if (announced.length) return announced;
  return typeof window !== "undefined" && "ethereum" in window ? all : [];
}

export function listWallets(): WalletOption[] {
  return connectors().map((c) => ({ id: c.id, name: c.id === "injected" ? "Browser wallet" : c.name, icon: c.icon }));
}

export function watchWallets(cb: () => void): () => void {
  return watchConnectors(wagmiConfig(), { onChange: cb });
}

/** Plain-words message for wallet and contract errors. */
export function friendlyError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; name?: string; cause?: unknown };
  const msg = `${e?.shortMessage ?? ""} ${e?.message ?? String(err)}`;
  if (/reject|denied|declined|cancel/i.test(msg)) return "You cancelled the request in your wallet.";
  if (/VoteTooSmall/.test(msg)) return "That vote is below the minimum.";
  if (/GameInactive/.test(msg)) return "This game is hidden and can't take votes.";
  if (/GameNotFound/.test(msg)) return "This game isn't listed.";
  if (/EnforcedPause|paused/i.test(msg)) return "Voting and listing are paused right now.";
  if (/InsufficientBalance|exceeds balance/i.test(msg)) return "Not enough $WIF in this wallet.";
  if (/InsufficientAllowance/i.test(msg)) return "The approval was too small. Approve again.";
  if (/insufficient funds/i.test(msg)) return "Not enough ETH on Robinhood Chain to pay for gas.";
  if (/chain|network/i.test(msg) && /mismatch|switch|does not match/i.test(msg)) return "Switch your wallet to Robinhood Chain.";
  return e?.shortMessage || e?.message?.split("\n")[0] || "Something went wrong.";
}

let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  watchConnection(wagmiConfig(), {
    onChange(conn) {
      if (conn.status === "connected") {
        useWallet.setState({
          status: "connected",
          address: conn.address,
          chainId: conn.chainId,
          walletName: conn.connector?.name ?? null,
        });
      } else if (conn.status === "disconnected") {
        useWallet.setState({ status: "disconnected", address: null, chainId: null, walletName: null });
      }
    },
  });
}

export async function connectWallet(id: string): Promise<boolean> {
  watch();
  const connector = connectors().find((c) => c.id === id);
  if (!connector) {
    useWallet.setState({ error: "That wallet isn't installed in this browser." });
    return false;
  }
  useWallet.setState({ status: "connecting", error: null });
  try {
    const res = await connect(wagmiConfig(), { connector, chainId: CHAIN.id }).catch(async (err) => {
      // Some wallets refuse chainId on connect; connect first, switch after.
      if (/chain/i.test(String(err))) return connect(wagmiConfig(), { connector });
      throw err;
    });
    const conn = getConnection(wagmiConfig());
    useWallet.setState({
      status: "connected",
      address: res.accounts[0],
      chainId: conn.chainId ?? null,
      walletName: connector.name,
      error: null,
    });
    writeJson(LAST_KEY, id);
    if (conn.chainId !== CHAIN.id) await switchToRobinhood();
    return true;
  } catch (err) {
    useWallet.setState({ status: "disconnected", error: friendlyError(err) });
    return false;
  }
}

/** One click: switch, or add then switch (wagmi falls back to wallet_addEthereumChain). */
export async function switchToRobinhood(): Promise<boolean> {
  try {
    await switchChain(wagmiConfig(), { chainId: CHAIN.id });
    useWallet.setState({ chainId: CHAIN.id, error: null });
    return true;
  } catch (err) {
    // Last resort for wallets that don't add chains on 4902.
    const provider = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum;
    if (provider && !/reject|denied|cancel/i.test(String(err))) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${CHAIN.id.toString(16)}`,
              chainName: CHAIN.name,
              nativeCurrency: CHAIN.nativeCurrency,
              rpcUrls: CHAIN.rpcUrls.default.http,
              blockExplorerUrls: [CHAIN.blockExplorers.default.url],
            },
          ],
        });
        useWallet.setState({ chainId: CHAIN.id, error: null });
        return true;
      } catch (err2) {
        useWallet.setState({ error: friendlyError(err2) });
        return false;
      }
    }
    useWallet.setState({ error: friendlyError(err) });
    return false;
  }
}

export async function disconnectWallet(): Promise<void> {
  writeJson(LAST_KEY, null);
  await disconnect(wagmiConfig()).catch(() => {});
  useWallet.setState({ status: "disconnected", address: null, chainId: null, walletName: null, error: null });
}

/** On load: quietly reconnect the last wallet if it still trusts this site. */
export async function restoreWallet(): Promise<void> {
  watch();
  const last = readJson<string | null>(LAST_KEY, null);
  if (!last) return;
  try {
    await reconnect(wagmiConfig());
    const conn = getConnection(wagmiConfig());
    if (conn.status === "connected") {
      useWallet.setState({
        status: "connected",
        address: conn.address,
        chainId: conn.chainId,
        walletName: conn.connector?.name ?? null,
      });
    }
  } catch {
    // Locked wallet or missing extension: stay disconnected.
  }
}
