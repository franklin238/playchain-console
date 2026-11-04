// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";

/// @notice Deploys PlayChainArcade. Reads every argument from the environment:
///   WIF          $WIF token address
///   TREASURY     treasury wallet (public address)
///   LISTING_FEE  base units, e.g. 1000000000000000000000 for 1,000 WIF
///   MIN_VOTE     base units, e.g. 100000000000000000000 for 100 WIF
///   EPOCH_LENGTH seconds, default 86400
/// Run with a Foundry keystore: --account playchain-deployer
contract Deploy is Script {
    function run() external returns (PlayChainArcade arcade) {
        address wif = vm.envAddress("WIF");
        address treasury = vm.envAddress("TREASURY");
        uint256 listingFee = vm.envUint("LISTING_FEE");
        uint256 minVote = vm.envUint("MIN_VOTE");
        uint256 epochLength = vm.envOr("EPOCH_LENGTH", uint256(86_400));

        vm.startBroadcast();
        arcade = new PlayChainArcade(wif, treasury, listingFee, minVote, epochLength);
        vm.stopBroadcast();

        console2.log("PlayChainArcade:", address(arcade));
        console2.log("Deploy block:", block.number);
        console2.log("Chain id:", block.chainid);
    }
}
