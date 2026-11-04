# Deploy guide (Steeve runs these)

Claude never sees a private key. You run every command that signs. These steps work in **Git Bash** on Windows (install Git for Windows first) or any macOS/Linux terminal.

## 0. What you need

- Foundry: `curl -L https://foundry.paradigm.xyz | bash`, then open a new terminal and run `foundryup`.
- Node.js 20 or newer.
- A deployer wallet with a little ETH on Robinhood Chain for gas.
- $WIF for the demo. With the default prices:
  - 3 game listings: 3 × 1,000 = **3,000 WIF** (all burned)
  - at least 10 demo votes across 3 wallets: 10 × 150 = **1,500 WIF**
  - total about **4,500 WIF** plus a buffer, split across your 3 voting wallets.
- A treasury wallet address (public address only).

## 1. Get the code

```bash
git clone playchain-flat.bundle playchain-flat     # or clone from GitHub once pushed
cd playchain-flat
git submodule update --init --recursive
```

## 2. Run the tests

```bash
cd contracts
forge test
forge test --match-path test/PlayChainArcade.fork.t.sol --fork-url https://rpc.mainnet.chain.robinhood.com
```

All tests must pass. The fork test uses the real $WIF on mainnet and checks it has no transfer fee.

## 3. Import your deployer key into an encrypted keystore (once)

You type the key yourself into Foundry's prompt. It is stored encrypted on your machine.

```bash
cast wallet import playchain-deployer --interactive
cast wallet address --account playchain-deployer
```

## 4. Set the deploy values

```bash
export RPC=https://rpc.mainnet.chain.robinhood.com
export WIF=0x5173b8eA6923c2d40267890D45C46a3480954773
export TREASURY=0xYOUR_TREASURY_ADDRESS
export LISTING_FEE=1000000000000000000000      # 1,000 WIF (18 decimals)
export MIN_VOTE=100000000000000000000          # 100 WIF
export EPOCH_LENGTH=86400                      # 1 day
```

## 5. Rehearse on a local fork first

```bash
anvil --fork-url $RPC &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --account playchain-deployer --broadcast
```

It prints `PlayChainArcade: 0x...` and `Deploy block: ...`. Stop anvil (`kill %1`) when done.

## 6. Deploy to mainnet

```bash
forge script script/Deploy.s.sol --rpc-url $RPC --account playchain-deployer --broadcast
```

Write down the address and the deploy block.

## 7. Verify the source on Blockscout

```bash
export ARCADE=0xTHE_ADDRESS_FROM_STEP_6
forge verify-contract $ARCADE src/PlayChainArcade.sol:PlayChainArcade \
  --chain-id 4663 --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256,uint256)" $WIF $TREASURY $LISTING_FEE $MIN_VOTE $EPOCH_LENGTH)
```

## 8. Deploy the site on Vercel

1. Push the repo to GitHub (see HOW-TO-OPEN.txt).
2. In Vercel: New Project → import the repo → **Root Directory: `web`** → Framework: Vite.
3. Environment variables (Production):
   - `VITE_ARCADE_ADDRESS` = the address from step 6
   - `VITE_DEPLOY_BLOCK` = the block from step 6
   - `VITE_SITE_ORIGIN` = your Vercel URL, for example `https://playchain-flat.vercel.app`
   - `VITE_REPO_URL` = your GitHub repo URL
4. Deploy. Open the site with no wallet: the shelf, Spotlight and games must load.

If your Vercel URL is not `https://playchain-flat.vercel.app`, update the `cover` and `playUrl` lines in each `web/public/games/*/meta.json` to your URL and redeploy before step 9, because the listing stores the meta.json URL onchain.

## 9. List the three games (burns 3,000 WIF)

```bash
export SITE_URL=https://playchain-flat.vercel.app    # your live URL, no trailing slash
forge script script/ListDemoGames.s.sol --rpc-url $RPC --account playchain-deployer --broadcast
```

## 10. Cast the demo votes

Use the live site with 3 different wallets (MetaMask or Rabby): connect, pick a game, Vote, Approve and vote. For rule 5 and the README table you need:

- at least 10 votes from at least 3 wallets
- at least 1 self-vote (the deployer wallet voting for one of its own games)
- votes on two different days, so one epoch rolls over and a Spotlight winner appears

Copy each transaction link from the vote sheet into the README table.

## 11. Keep it live until 16 Nov 2026, 17:30 UTC

- Do not pause the contract.
- Do not push breaking changes after 12 Nov 17:30 UTC. Only the logo may change.
- Set up a free uptime check (for example UptimeRobot) on the site URL every 15 minutes.
