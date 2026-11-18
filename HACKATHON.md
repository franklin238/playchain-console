# PlayChain: guide for judges

**PlayChain is a browser game console on Robinhood Chain where players decide which games get seen. Every $WIF vote is split onchain in the same transaction: 35% burned, 40% to the game's developer, 25% to the treasury. The game with the most votes today holds the Spotlight. Developers can also be tipped in Paxos USDG.**

- **Live site:** https://playchain-console.vercel.app (Robinhood Chain Testnet, chain 46630)
- **Code:** https://github.com/franklin238/playchain-console (MIT)
- **Builder:** Steeve, solo ([@gamersteeve](https://x.com/gamersteeve))

## Try it in 3 minutes

1. Open the site. The Spotlight, the shelf and the Live Race are read live from the contract. Every game is playable without a wallet.
2. Click **Connect** and connect MetaMask or Rabby. Approve the switch to **Robinhood Chain Testnet**.
3. In the wallet menu:
   - **Get free test ETH (gas)** opens the official faucet: https://faucet.testnet.chain.robinhood.com
   - **Get 5,000 test $WIF** mints tWIF to you from the `TestWIF` faucet (once an hour).
4. Open any game and press **Vote with $WIF**. The sheet previews the exact split before you sign. Approve the exact amount, then vote.
5. Watch the Live Race and the burn counter update. Out-vote the leader and the **Spotlight takeover** plays on the home screen. Every transaction links to the explorer.
6. Optional, USDG: get test USDG from https://faucet.paxos.com (choose Robinhood Chain Testnet), then use **Tip in USDG** on a game's page.

## Contracts (source verified on the explorer)

| Contract | Address |
|---|---|
| `PlayChainArcade` | [`0x9883Ab79132e1f0A29cAaEB434Fa80eA1bfc30B4`](https://explorer.testnet.chain.robinhood.com/address/0x9883Ab79132e1f0A29cAaEB434Fa80eA1bfc30B4) |
| `PlayChainTips` | [`0xe874A9BC72e60c3f2feA280443bBC0C0A13F67A6`](https://explorer.testnet.chain.robinhood.com/address/0xe874A9BC72e60c3f2feA280443bBC0C0A13F67A6) |
| `TestWIF` (tWIF) | [`0x5c7DB26AdD41cdEADff4C8256cc895ED480C8e9D`](https://explorer.testnet.chain.robinhood.com/address/0x5c7DB26AdD41cdEADff4C8256cc895ED480C8e9D) |
| Paxos USDG (testnet) | [`0x7E955252E15c84f5768B83c41a71F9eba181802F`](https://explorer.testnet.chain.robinhood.com/address/0x7E955252E15c84f5768B83c41a71F9eba181802F) |

On mainnet the same arcade contract runs with the real $WIF (`0x5173b8eA6923c2d40267890D45C46a3480954773`); a fork test already runs it against the real token.

## How this answers the judging criteria

**Smart contract quality**
- Solidity 0.8.24, OpenZeppelin v5, `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `SafeERC20`.
- **No custody:** every token goes straight from the voter or tipper to the burn address, developer and treasury. Invariant and fork tests check that the contracts' balances stay at zero.
- **Capped owner powers**, enforced onchain: the treasury share is at most 40% of a vote (20% of a tip), the burn is at least 20%, and the owner can never move anyone's tokens.
- **Tests:** 61 unit, fuzz and invariant tests. Coverage is 100% of lines, branches and functions on `PlayChainArcade`. Fork tests run against the real $WIF on mainnet and against this testnet deployment with Paxos' real USDG.

**Product-market fit**
- Players get a console: four complete original games, achievements, high scores, themes and soundtracks, on desktop and phones, with no install and no sign-up.
- Indie developers get paid directly: 40% of every vote, the moment it happens, plus stablecoin tips.
- A new race every day gives players a reason to come back and developers a reason to bring their audience.

**Innovation and creativity**
- Voting is the business model: a vote is at once curation, a burn and a direct payment to the developer.
- Games run sandboxed with no wallet access, and talk to the console through a small `postMessage` bridge for scores, saves, exit and pause.
- Self-votes burn the developer's share, so nobody can buy the Spotlight at a discount. USDG tips are kept apart from the race, so dollars can't buy it either.

**Real problem solving**
- Good indie web games go unseen, and developers rarely earn from the people who enjoy them. PlayChain lets players decide what gets seen and pays developers in the same transaction.

**Paxos USDG integration**
- `PlayChainTips` lets anyone tip a game's developer in USDG: 90% to the developer and 10% to the treasury. The game page has a tip panel, and the wallet menu links to Paxos' faucet.

## What's next

- Mainnet launch with the real $WIF (the contract and deploy scripts are ready; see `DEPLOY.md`).
- Outside developers: a self-serve allowlist and per-game analytics.
- Daily tournaments with replay-verified scores.

PlayChain is an independent project, not affiliated with, endorsed by, or connected to Robinhood Markets, Inc. or Paxos. Testnet tokens have no value.
