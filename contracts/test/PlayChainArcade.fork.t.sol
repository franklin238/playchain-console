// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";

/// @notice Runs against a fork of Robinhood Chain mainnet with the real $WIF token.
///         forge test --match-path test/PlayChainArcade.fork.t.sol --fork-url $RPC -vvv
///         Skips itself when not forking chain 4663.
contract PlayChainArcadeForkTest is Test {
    address constant WIF = 0x5173b8eA6923c2d40267890D45C46a3480954773;
    address constant BURN = 0x000000000000000000000000000000000000dEaD;
    IERC20 wif = IERC20(WIF);

    PlayChainArcade arcade;
    address treasury = makeAddr("treasury");
    address dev = makeAddr("dev");
    address voter = makeAddr("voter");

    function setUp() public {
        if (block.chainid != 4663) return;
        arcade = new PlayChainArcade(WIF, treasury, 1_000e18, 100e18, 1 days);
        // Fund test wallets with real $WIF by writing balances (works for standard OZ ERC-20 storage).
        deal(WIF, dev, 10_000e18);
        deal(WIF, voter, 10_000e18);
    }

    function test_fork_tokenIsPlainERC20() public {
        if (block.chainid != 4663) return;
        address a = makeAddr("a");
        address b = makeAddr("b");
        deal(WIF, a, 1_000e18);
        vm.prank(a);
        wif.transfer(b, 1_000e18);
        assertEq(wif.balanceOf(b), 1_000e18, "fee-on-transfer detected");
        assertEq(wif.balanceOf(a), 0);
    }

    function test_fork_listAndVote() public {
        if (block.chainid != 4663) return;
        uint256 burnStart = wif.balanceOf(BURN);

        vm.startPrank(dev);
        wif.approve(address(arcade), 1_000e18);
        uint256 id = arcade.listGame("https://playchain-console.vercel.app/games/neon-tide/meta.json");
        vm.stopPrank();
        assertEq(wif.balanceOf(BURN) - burnStart, 1_000e18);

        uint256 devBefore = wif.balanceOf(dev);
        vm.startPrank(voter);
        wif.approve(address(arcade), 300e18);
        arcade.vote(id, 300e18);
        vm.stopPrank();

        assertEq(wif.balanceOf(BURN) - burnStart, 1_105e18);
        assertEq(wif.balanceOf(dev) - devBefore, 120e18);
        assertEq(wif.balanceOf(treasury), 75e18);
        assertEq(wif.balanceOf(address(arcade)), 0);
        assertEq(arcade.leaderOf(0), id);
    }
}
