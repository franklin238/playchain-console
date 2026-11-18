// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {PlayChainTips} from "../src/PlayChainTips.sol";
import {TestWIF} from "../src/testnet/TestWIF.sol";

/// @notice Everything for Robinhood Chain Testnet in one run: deploys TestWIF, PlayChainArcade
///         (same rules as mainnet) and PlayChainTips (USDG tips), lists the four games and casts a
///         few opening votes so the Spotlight race isn't empty. Refuses to run on mainnet.
///   SITE_URL  live site, e.g. https://playchain-console.vercel.app (no trailing slash)
///   TREASURY  optional, defaults to the deployer
///   USDG      optional, defaults to Paxos USDG on Robinhood Chain Testnet
/// Run with a Foundry keystore:
///   forge script script/DeployTestnet.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account playchain-testnet --broadcast
contract DeployTestnet is Script {
    uint256 internal constant LISTING_FEE = 100 ether; // 100 tWIF, burned per listing
    uint256 internal constant MIN_VOTE = 100 ether; // 100 tWIF smallest vote
    uint256 internal constant EPOCH_LENGTH = 1 days; // one Spotlight race per day
    uint256 internal constant SUPPLY = 100_000 ether;
    /// @dev Paxos USDG on Robinhood Chain Testnet (docs.paxos.com/guides/stablecoin/usdg/testnet), 6 decimals.
    address internal constant PAXOS_USDG_TESTNET = 0x7E955252E15c84f5768B83c41a71F9eba181802F;
    uint256 internal constant MIN_TIP = 1e6; // 1 USDG

    function run() external returns (TestWIF wif, PlayChainArcade arcade, PlayChainTips tips) {
        require(block.chainid != 4663, "DeployTestnet: this is mainnet");
        string memory site = vm.envString("SITE_URL");
        address treasury = vm.envOr("TREASURY", msg.sender);
        address usdg = vm.envOr("USDG", PAXOS_USDG_TESTNET);

        string[4] memory slugs = ["neon-tide", "hollow-kingdom", "signal-lost", "gloam-vesper"];
        // Opening votes in tWIF, by game: today's race starts with Signal Lost ahead.
        uint256[4] memory opening = [uint256(300 ether), 400 ether, 900 ether, 100 ether];

        vm.startBroadcast();
        wif = new TestWIF(SUPPLY);
        arcade = new PlayChainArcade(address(wif), treasury, LISTING_FEE, MIN_VOTE, EPOCH_LENGTH);
        wif.approve(address(arcade), type(uint256).max);
        uint256[4] memory ids;
        for (uint256 i; i < slugs.length; ++i) {
            ids[i] = arcade.listGame(string.concat(site, "/games/", slugs[i], "/meta.json"));
        }
        for (uint256 i; i < ids.length; ++i) arcade.vote(ids[i], opening[i]);
        wif.approve(address(arcade), 0);
        tips = new PlayChainTips(address(arcade), usdg, treasury, MIN_TIP);
        vm.stopBroadcast();

        console2.log("TestWIF:", address(wif));
        console2.log("PlayChainArcade:", address(arcade));
        console2.log("PlayChainTips:", address(tips));
        console2.log("Deploy block:", block.number);
        console2.log("Chain id:", block.chainid);
        for (uint256 i; i < slugs.length; ++i) console2.log(slugs[i], ids[i]);
    }
}
