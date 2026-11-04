// $WIF amounts. Decimals are read from the token once, never assumed.

import { formatUnits, parseUnits } from "viem";
import { consoleConfig } from "../config/console.config";
import { erc20Abi } from "../config/contracts";
import { publicClient } from "./client";

let decimalsPromise: Promise<number> | null = null;
let decimalsKnown: number | null = null;

export function wifDecimals(): Promise<number> {
  decimalsPromise ??= publicClient()
    .readContract({ address: consoleConfig.wifAddress, abi: erc20Abi, functionName: "decimals" })
    .then((d) => {
      decimalsKnown = Number(d);
      return decimalsKnown;
    })
    .catch((err) => {
      decimalsPromise = null;
      throw err;
    });
  return decimalsPromise;
}

/** Decimals once loaded (18 is only a display placeholder before the first read). */
export function decimalsOrNull(): number | null {
  return decimalsKnown;
}

/** "1,234.5" with up to `max` fraction digits. */
export function formatWif(amount: bigint, decimals = decimalsKnown ?? 18, max = 2): string {
  const s = formatUnits(amount, decimals);
  const [int, frac = ""] = s.split(".");
  const intFmt = BigInt(int).toLocaleString("en-US");
  const f = frac.slice(0, max).replace(/0+$/, "");
  return f ? `${intFmt}.${f}` : intFmt;
}

/** Compact: 1.2K, 3.4M. */
export function formatWifShort(amount: bigint, decimals = decimalsKnown ?? 18): string {
  const n = Number(formatUnits(amount, decimals));
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Parse what the player typed. Returns null when it isn't a valid positive amount. */
export function parseWif(text: string, decimals: number): bigint | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [, frac = ""] = t.split(".");
  if (frac.length > decimals) return null;
  try {
    const v = parseUnits(t, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

export async function wifBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient().readContract({
    address: consoleConfig.wifAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}
