// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {MockWIF} from "./mocks/MockWIF.sol";

/// @dev Drives random listings, votes and epoch rollovers, and tracks what left voters.
contract ArcadeHandler is Test {
    PlayChainArcade public arcade;
    MockWIF public wif;
    address[] public actors;

    uint256 public ghostVoted; // sum of Voted.amount
    uint256 public ghostListed; // sum of listing fees
    uint256 public ghostPaidOut; // tokens that left actors, net of dev income

    constructor(PlayChainArcade a, MockWIF w) {
        arcade = a;
        wif = w;
        for (uint256 i; i < 4; ++i) {
            address u = makeAddr(string(abi.encodePacked("actor", vm.toString(i))));
            actors.push(u);
            wif.mint(u, 10_000_000e18);
            vm.prank(u);
            wif.approve(address(arcade), type(uint256).max);
        }
    }

    function list(uint256 who) external {
        address u = actors[who % actors.length];
        vm.prank(u);
        arcade.listGame("https://example.com/meta.json");
        ghostListed += arcade.listingFee();
    }

    function vote(uint256 who, uint256 id, uint256 amount) external {
        uint256 count = arcade.gameCount();
        if (count == 0) return;
        id = bound(id, 1, count);
        amount = bound(amount, arcade.minVote(), 50_000e18);
        address u = actors[who % actors.length];
        vm.prank(u);
        arcade.vote(id, amount);
        ghostVoted += amount;
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }
}

contract PlayChainArcadeInvariantTest is Test {
    PlayChainArcade arcade;
    MockWIF wif;
    ArcadeHandler handler;
    address treasury = makeAddr("treasury");
    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        wif = new MockWIF();
        arcade = new PlayChainArcade(address(wif), treasury, 1_000e18, 100e18, 1 days);
        handler = new ArcadeHandler(arcade, wif);
        targetContract(address(handler));
    }

    /// The contract never holds $WIF.
    function invariant_contractHoldsNothing() public view {
        assertEq(wif.balanceOf(address(arcade)), 0);
    }

    /// Every token spent on votes and listings ends up burned, with the treasury or with a developer.
    function invariant_conservation() public view {
        uint256 actorsNow;
        for (uint256 i; i < 4; ++i) actorsNow += wif.balanceOf(handler.actors(i));
        uint256 minted = 4 * 10_000_000e18;
        // Developers are actors too, so tokens leaving the actor set = burn + treasury.
        assertEq(minted - actorsNow, wif.balanceOf(BURN) + wif.balanceOf(treasury));
        assertLe(wif.balanceOf(BURN) + wif.balanceOf(treasury), handler.ghostVoted() + handler.ghostListed());
    }

    /// Lifetime votes across games equal the sum of Voted amounts.
    function invariant_totalVotesMatch() public view {
        uint256 sum;
        uint256 n = arcade.gameCount();
        for (uint256 i = 1; i <= n; ++i) sum += arcade.getGame(i).totalVotes;
        assertEq(sum, handler.ghostVoted());
    }

    /// The leader of each epoch has the most votes in it.
    function invariant_leaderIsMax() public view {
        uint256 e = arcade.currentEpoch();
        uint256 n = arcade.gameCount();
        uint256 best;
        for (uint256 i = 1; i <= n; ++i) {
            uint256 v = arcade.votesInEpoch(e, i);
            if (v > best) best = v;
        }
        assertEq(arcade.leaderVotes(e), best);
        if (best > 0) assertEq(arcade.votesInEpoch(e, arcade.leaderOf(e)), best);
    }
}
