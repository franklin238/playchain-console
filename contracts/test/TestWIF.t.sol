// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestWIF} from "../src/testnet/TestWIF.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {PlayChainTips} from "../src/PlayChainTips.sol";
import {DeployTestnet} from "../script/DeployTestnet.s.sol";

contract TestWIFTest is Test {
    TestWIF wif;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.chainId(46630);
        wif = new TestWIF(1_000 ether);
    }

    function test_MintsInitialSupplyToDeployer() public view {
        assertEq(wif.balanceOf(address(this)), 1_000 ether);
        assertEq(wif.symbol(), "tWIF");
        assertEq(wif.decimals(), 18);
    }

    function test_FaucetDripsOncePerHour() public {
        vm.warp(10_000);
        vm.prank(alice);
        wif.faucet();
        assertEq(wif.balanceOf(alice), 5_000 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TestWIF.FaucetCooldown.selector, 10_000 + 1 hours));
        wif.faucet();

        vm.warp(10_000 + 1 hours);
        vm.prank(alice);
        wif.faucet();
        assertEq(wif.balanceOf(alice), 10_000 ether);
    }

    function test_RefusesMainnet() public {
        vm.chainId(4663);
        vm.expectRevert(TestWIF.MainnetNotAllowed.selector);
        new TestWIF(1);
    }

    function test_DeployScriptListsGamesAndSeedsVotes() public {
        vm.setEnv("SITE_URL", "https://playchain-console.vercel.app");
        (TestWIF t, PlayChainArcade arcade, PlayChainTips tips) = new DeployTestnet().run();
        assertEq(address(tips.arcade()), address(arcade));
        assertEq(address(tips.stable()), 0x7E955252E15c84f5768B83c41a71F9eba181802F);
        assertEq(arcade.gameCount(), 4);
        assertEq(address(arcade.wif()), address(t));
        uint256 e = arcade.currentEpoch();
        assertEq(arcade.leaderOf(e), 3, "Signal Lost leads the opening race");
        assertEq(arcade.votesInEpoch(e, 3), 900 ether);
        assertEq(arcade.getGame(4).metadataURI, "https://playchain-console.vercel.app/games/gloam-vesper/meta.json");
    }

    function test_DeployScriptRefusesMainnet() public {
        vm.chainId(4663);
        vm.setEnv("SITE_URL", "https://playchain-console.vercel.app");
        DeployTestnet s = new DeployTestnet();
        vm.expectRevert(bytes("DeployTestnet: this is mainnet"));
        s.run();
    }
}
