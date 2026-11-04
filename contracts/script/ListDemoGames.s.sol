// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";

/// @notice Approves the exact listing fee and lists each demo game from the broadcaster's wallet.
///   ARCADE    deployed PlayChainArcade address
///   SITE_URL  live site, e.g. https://playchain-flat.vercel.app (no trailing slash)
contract ListDemoGames is Script {
    function run() external {
        PlayChainArcade arcade = PlayChainArcade(vm.envAddress("ARCADE"));
        string memory site = vm.envString("SITE_URL");
        string[4] memory slugs = ["neon-tide", "hollow-kingdom", "signal-lost", "rise-of-gamdom-man"];
        IERC20 wif = arcade.wif();
        uint256 fee = arcade.listingFee();

        vm.startBroadcast();
        for (uint256 i; i < slugs.length; ++i) {
            if (fee > 0) wif.approve(address(arcade), fee);
            uint256 id = arcade.listGame(string.concat(site, "/games/", slugs[i], "/meta.json"));
            console2.log(slugs[i], id);
        }
        vm.stopBroadcast();
    }
}
