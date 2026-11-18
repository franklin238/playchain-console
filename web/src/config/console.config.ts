// PlayChain configuration. Public values only: everything in this file
// ships in the website bundle. Never put a private key or secret here.

const env = import.meta.env;

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** VITE_NETWORK=testnet runs the console on Robinhood Chain Testnet with test $WIF (tWIF). */
const testnet = env.VITE_NETWORK === "testnet";

export const consoleConfig = {
  name: "PlayChain",

  testnet,
  /** Robinhood Chain mainnet (4663), or its testnet (46630). */
  chainId: testnet ? 46630 : 4663,
  networkName: testnet ? "Robinhood Chain Testnet" : "Robinhood Chain",
  explorer: testnet ? "https://explorer.testnet.chain.robinhood.com" : "https://robinhoodchain.blockscout.com",
  /** Where testers get free testnet ETH for gas. */
  gasFaucet: "https://faucet.testnet.chain.robinhood.com",

  /** $WIF on Robinhood Chain (verified onchain: symbol WIF, 18 decimals). On testnet: TestWIF, from VITE_WIF_ADDRESS. */
  wifAddress: (testnet ? env.VITE_WIF_ADDRESS || "" : "0x5173b8eA6923c2d40267890D45C46a3480954773") as `0x${string}`,
  burnAddress: "0x000000000000000000000000000000000000dEaD" as `0x${string}`,

  /** PlayChainArcade. Empty until Duke deploys it; the console then runs in preview mode. */
  arcadeAddress: (env.VITE_ARCADE_ADDRESS || "") as `0x${string}` | "",
  /** PlayChainTips: stablecoin tips to developers. Empty hides tipping. */
  tipsAddress: (env.VITE_TIPS_ADDRESS || "") as `0x${string}` | "",
  /** Paxos USDG (6 decimals). Testnet default: docs.paxos.com/guides/stablecoin/usdg/testnet. */
  usdgAddress: (env.VITE_USDG_ADDRESS || (testnet ? "0x7E955252E15c84f5768B83c41a71F9eba181802F" : "")) as `0x${string}` | "",
  /** Where testers get free test USDG. */
  usdgFaucet: "https://faucet.paxos.com",

  /** Block the arcade was deployed in. The activity feed reads logs from here. */
  deployBlock: BigInt(env.VITE_DEPLOY_BLOCK || "0"),

  /** Extra RPC URL tried before the public ones. */
  rpcUrl: env.VITE_RPC_URL || "",

  /** Production site. Game URLs on this origin are served from the console's own origin. */
  siteOrigin: (env.VITE_SITE_ORIGIN || "https://playchain-console.vercel.app").replace(/\/$/, ""),

  /** Origins games may be played from, besides the console's own origin and siteOrigin. */
  extraPlayOrigins: list(env.VITE_PLAY_ORIGINS),

  /** How many days the Spotlight looks at, today first, to find one with votes. */
  spotlightLookback: 30,
  /** Contract views refresh this often, and after every confirmed transaction. */
  refreshMs: 15_000,
  /** Activity feed log query chunk size, in blocks. */
  logChunk: testnet ? 5_000_000n : 10_000n, // testnet makes ~5 blocks a second and its RPC serves wide log ranges

  /** Largest save a game may store through the bridge. */
  saveMaxBytes: 60 * 1024,

  bootDurationMs: 1500,

  links: {
    repo: env.VITE_REPO_URL || "https://github.com/franklin238/playchain-console",
    /** The console owner on X: developers ask here to have their website approved. */
    ownerX: "gamersteeve",
  },
} as const;

export const GENRES = ["Action", "Strategy", "Puzzle", "Story", "Arcade", "Multiplayer", "Other"] as const;
export type Genre = (typeof GENRES)[number];

export const DISCLAIMER =
  "PlayChain is an independent project, not affiliated with, endorsed by, or connected to Robinhood Markets, Inc.";
