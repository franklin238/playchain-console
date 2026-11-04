#!/usr/bin/env bash
# End-to-end rehearsal on a local fork of Robinhood Chain mainnet, with the real $WIF.
#   1. starts anvil forking mainnet (chain id stays 4663)
#   2. funds three anvil test accounts with $WIF from a large holder (impersonated, fork only)
#   3. deploys PlayChainArcade, lists the three demo games, casts one vote
# Then build the console against the fork and run the browser test:
#   VITE_ARCADE_ADDRESS=<printed> VITE_DEPLOY_BLOCK=<printed> VITE_RPC_URL=http://127.0.0.1:8545 npx vite build --outDir dist-e2e
#   PCF_E2E_RPC=http://127.0.0.1:8545 npx vite preview --outDir dist-e2e --port 4950
#   node tests/e2e/vote-flow.mjs   (needs playwright-core and Chrome)
# The private keys below are anvil's public test keys. They only exist on the local fork.
set -euo pipefail
RPC=${RPC:-https://rpc.mainnet.chain.robinhood.com}
A=http://127.0.0.1:8545
WIF=0x5173b8eA6923c2d40267890D45C46a3480954773
WHALE=${WHALE:-0x8366a39cc670b4001a1121b8f6a443a643e40951}
K0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
K1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
cd "$(dirname "$0")/../../../contracts"

anvil --fork-url "$RPC" --port 8545 --silent &
sleep 6
cast rpc anvil_impersonateAccount $WHALE --rpc-url $A >/dev/null
cast rpc anvil_setBalance $WHALE 0x8AC7230489E80000 --rpc-url $A >/dev/null
for acc in 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; do
  cast send $WIF "transfer(address,uint256)" $acc 100000000000000000000000 --from $WHALE --unlocked --rpc-url $A >/dev/null
done
OUT=$(WIF=$WIF TREASURY=0x90F79bf6EB2c4f870365E785982E1f101E93b906 LISTING_FEE=1000000000000000000000 MIN_VOTE=100000000000000000000 \
  forge script script/Deploy.s.sol --rpc-url $A --private-key $K0 --broadcast 2>&1)
ARCADE=$(echo "$OUT" | grep "PlayChainArcade:" | awk '{print $2}')
echo "$OUT" | grep -E "PlayChainArcade:|Deploy block"
ARCADE=$ARCADE SITE_URL=https://playchain-flat.vercel.app forge script script/ListDemoGames.s.sol --rpc-url $A --private-key $K0 --broadcast >/dev/null
cast send $WIF "approve(address,uint256)" $ARCADE 300000000000000000000 --private-key $K1 --rpc-url $A >/dev/null
cast send $ARCADE "vote(uint256,uint256)" 2 300000000000000000000 --private-key $K1 --rpc-url $A >/dev/null
echo "Fork ready. Games listed: $(cast call $ARCADE 'gameCount()(uint256)' --rpc-url $A)"
wait
