// PlayChain Flat configuration. Public values only: everything in this file
// ships in the website bundle. Never put a private key or secret here.

const env = import.meta.env;

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export const consoleConfig = {
  name: "PlayChain Flat",

  /** Robinhood Chain mainnet. */
  chainId: 4663,
  explorer: "https://robinhoodchain.blockscout.com",

  /** $WIF on Robinhood Chain (verified onchain: symbol WIF, 18 decimals). */
  wifAddress: "0x5173b8eA6923c2d40267890D45C46a3480954773" as `0x${string}`,
  burnAddress: "0x000000000000000000000000000000000000dEaD" as `0x${string}`,

  /** PlayChainArcade. Empty until Duke deploys it; the console then runs in preview mode. */
  arcadeAddress: (env.VITE_ARCADE_ADDRESS || "") as `0x${string}` | "",
  /** Block the arcade was deployed in. The activity feed reads logs from here. */
  deployBlock: BigInt(env.VITE_DEPLOY_BLOCK || "0"),

  /** Extra RPC URL tried before the public ones. */
  rpcUrl: env.VITE_RPC_URL || "",

  /** Production site. Game URLs on this origin are served from the console's own origin. */
  siteOrigin: (env.VITE_SITE_ORIGIN || "https://playchain-flat.vercel.app").replace(/\/$/, ""),

  /** Origins games may be played from, besides the console's own origin and siteOrigin. */
  extraPlayOrigins: list(env.VITE_PLAY_ORIGINS),

  /** How far back the Spotlight looks for a previous epoch with votes. */
  spotlightLookback: 30,
  /** Contract views refresh this often, and after every confirmed transaction. */
  refreshMs: 15_000,
  /** Activity feed log query chunk size, in blocks. */
  logChunk: 10_000n,

  /** Largest save a game may store through the bridge. */
  saveMaxBytes: 60 * 1024,

  bootDurationMs: 1500,

  links: {
    hackathon: "https://worldisflat.fun/build",
    repo: env.VITE_REPO_URL || "https://github.com/franklin238/playchain-flat",
  },
} as const;

export const GENRES = ["Action", "Strategy", "Puzzle", "Story", "Arcade", "Multiplayer", "Other"] as const;
export type Genre = (typeof GENRES)[number];

export const DISCLAIMER =
  "PlayChain Flat is an independent project, not affiliated with, endorsed by, or connected to Robinhood Markets, Inc.";
