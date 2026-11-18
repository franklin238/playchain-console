// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {PlayChainTips} from "../src/PlayChainTips.sol";
import {TestWIF} from "../src/testnet/TestWIF.sol";

/// @notice Runs a new player's whole journey against the live Robinhood Chain Testnet deployment
///         (a local fork, so nothing is spent): claim tWIF, vote, take the Spotlight, tip in real
///         Paxos USDG. Run with:
///   forge test --match-path test/Testnet.fork.t.sol --fork-url https://rpc.testnet.chain.robinhood.com
contract TestnetForkTest is Test {
    PlayChainArcade constant ARCADE = PlayChainArcade(0x9883Ab79132e1f0A29cAaEB434Fa80eA1bfc30B4);
    PlayChainTips constant TIPS = PlayChainTips(0xe874A9BC72e60c3f2feA280443bBC0C0A13F67A6);
    TestWIF constant TWIF = TestWIF(0x5c7DB26AdD41cdEADff4C8256cc895ED480C8e9D);
    IERC20 constant USDG = IERC20(0x7E955252E15c84f5768B83c41a71F9eba181802F);
    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    address player = makeAddr("player");

    function setUp() public {
        if (block.chainid != 46630) vm.skip(true);
    }

    function test_DeploymentIsWiredUp() public view {
        assertEq(address(ARCADE.wif()), address(TWIF));
        assertEq(address(TIPS.arcade()), address(ARCADE));
        assertEq(address(TIPS.stable()), address(USDG));
        assertEq(ARCADE.gameCount(), 4);
        assertEq(ARCADE.burnBps() + ARCADE.devBps() + ARCADE.treasuryBps(), 10_000);
    }

    function test_NewPlayerVotesAndTakesTheSpotlight() public {
        vm.startPrank(player);
        TWIF.faucet();
        assertEq(TWIF.balanceOf(player), 5_000 ether);

        uint256 vesper = 4;
        PlayChainArcade.Game memory g = ARCADE.getGame(vesper);
        uint256 e = ARCADE.currentEpoch();
        uint256 needed = ARCADE.leaderVotes(e) - ARCADE.votesInEpoch(e, vesper) + 1 ether;

        uint256 burnBefore = TWIF.balanceOf(BURN);
        uint256 devBefore = TWIF.balanceOf(g.developer);
        TWIF.approve(address(ARCADE), needed);
        ARCADE.vote(vesper, needed);
        vm.stopPrank();

        assertEq(ARCADE.leaderOf(e), vesper, "GLOAM: VESPER takes the Spotlight");
        assertEq(TWIF.balanceOf(BURN) - burnBefore, needed * ARCADE.burnBps() / 10_000);
        // Here the developer wallet is also the treasury, so it receives both shares.
        uint256 devShare = needed * ARCADE.devBps() / 10_000;
        if (g.developer == ARCADE.treasury()) devShare += needed * ARCADE.treasuryBps() / 10_000;
        assertEq(TWIF.balanceOf(g.developer) - devBefore, devShare);
        assertEq(TWIF.balanceOf(address(ARCADE)), 0, "the arcade never holds tokens");
    }

    function test_TipInRealUSDG() public {
        uint256 amount = 5e6; // 5 USDG
        deal(address(USDG), player, amount);
        uint256 id = 3;
        address dev = ARCADE.getGame(id).developer;
        address treasury = TIPS.treasury();
        uint256 devBefore = USDG.balanceOf(dev);
        uint256 treasuryBefore = USDG.balanceOf(treasury);

        vm.startPrank(player);
        USDG.approve(address(TIPS), amount);
        TIPS.tip(id, amount);
        vm.stopPrank();

        uint256 toTreasury = amount * TIPS.treasuryBps() / 10_000;
        // On this deployment the developer and the treasury are the same wallet, so check the sum too.
        assertEq((USDG.balanceOf(dev) - devBefore) + (dev == treasury ? 0 : USDG.balanceOf(treasury) - treasuryBefore), amount);
        if (dev != treasury) assertEq(USDG.balanceOf(treasury) - treasuryBefore, toTreasury);
        assertEq(USDG.balanceOf(address(TIPS)), 0, "tips never stay in the contract");
        assertEq(USDG.balanceOf(player), 0);
        assertEq(TIPS.totalTips(id), amount);
    }
}
