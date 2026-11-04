// Read-only chain access and the wagmi config for wallets.
// Reads use a public client with RPC fallback; writes go through the connected wallet.

import { createConfig, injected, type Config } from "@wagmi/core";
import { createPublicClient, fallback, http, type PublicClient, type Transport } from "viem";
import { robinhood } from "viem/chains";
import { consoleConfig } from "../config/console.config";

export const CHAIN = robinhood;

function transport(): Transport {
  const urls = [consoleConfig.rpcUrl, ...CHAIN.rpcUrls.default.http].filter(Boolean);
  return fallback(
    [...new Set(urls)].map((u) => http(u, { timeout: 12_000, retryCount: 1 })),
    { rank: false },
  );
}

let client: PublicClient | null = null;
export function publicClient(): PublicClient {
  client ??= createPublicClient({ chain: CHAIN, transport: transport(), batch: { multicall: true } }) as PublicClient;
  return client;
}

let config: Config | null = null;
export function wagmiConfig(): Config {
  config ??= createConfig({
    chains: [CHAIN],
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    transports: { [CHAIN.id]: transport() },
  });
  return config;
}

export function txUrl(hash: string): string {
  return `${consoleConfig.explorer}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${consoleConfig.explorer}/address/${address}`;
}

export const arcadeDeployed = (): boolean => /^0x[0-9a-fA-F]{40}$/.test(consoleConfig.arcadeAddress);
