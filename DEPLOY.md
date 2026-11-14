# Going live: deploy guide

These steps turn PlayChain from demo mode into real $WIF voting on Robinhood Chain. Run them in **Git Bash** on Windows or any macOS/Linux terminal.

Never paste a private key into a chat, a file or a website. You type it once into Foundry's own prompt (step 3), which stores it encrypted.

## 0. What you need

- **Foundry** (forge, cast, anvil). Check with `forge --version`.
- **Node.js** 20 or newer.
- **A deployer wallet** with a little ETH on Robinhood Chain for gas. A few dollars' worth is plenty.
- **$WIF to list the three games.** With the listing fee below that's 3 × 100 = **300 WIF**, all burned.
- **A treasury address** that receives 10% of every vote. Your deployer address is fine.

## 1. Get the code

```bash
git clone https://github.com/franklin238/playchain.git
cd playchain
git submodule update --init --recursive
```

## 2. Run the tests

```bash
cd contracts
forge test
forge test --match-path test/PlayChainArcade.fork.t.sol --fork-url https://rpc.mainnet.chain.robinhood.com
```

All tests must pass. The fork test uses the real $WIF on mainnet and checks it has no transfer fee.

## 3. Import your deployer key (once)

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
export LISTING_FEE=100000000000000000000       # 100 WIF to list a game (18 decimals)
export MIN_VOTE=100000000000000000000          # 100 WIF smallest vote
export EPOCH_LENGTH=86400                      # 1 day per Spotlight race
```

The owner can change the listing fee and minimum vote later with `setFees`, so these aren't permanent.

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

Verified source lets players read the contract before they vote.

## 8. Point the site at the contract

1. In Vercel, open the PlayChain project → Settings → Environment Variables (Production):
   - `VITE_ARCADE_ADDRESS` = the address from step 6
   - `VITE_DEPLOY_BLOCK` = the block from step 6
   - `VITE_SITE_ORIGIN` = your Vercel URL, for example `https://playchain-console.vercel.app`
   - `VITE_REPO_URL` = `https://github.com/franklin238/playchain`
2. Deployments → latest → **Redeploy**.
3. Open the site with no wallet: the shelf, Spotlight and games must load, and the demo-mode notice must be gone.

If your Vercel URL is not `https://playchain-console.vercel.app`, first update the `cover` and `playUrl` lines in each `web/public/games/*/meta.json` to your URL and push. The listing stores the meta.json URL onchain, so it has to be right before step 9.

## 9. List the three games (burns 300 WIF)

```bash
export SITE_URL=https://playchain-console.vercel.app    # your live URL, no trailing slash
forge script script/ListDemoGames.s.sol --rpc-url $RPC --account playchain-deployer --broadcast
```

## 10. Check it with one real vote

Before you tell anyone, connect your own wallet on the live site and cast one minimum vote. Check on Blockscout that half was burned, 40% went to the developer and 10% to the treasury. Then share the link.

## Running it

- `pause` / `unpause` stop and restart voting if something goes wrong. Nobody's tokens are held by the contract, so pausing never locks funds.
- `setGameActive(id, false)` hides an abusive listing.
- Add a free uptime check (for example UptimeRobot) on the site URL.
