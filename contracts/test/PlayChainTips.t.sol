// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {PlayChainTips} from "../src/PlayChainTips.sol";
import {MockWIF} from "./mocks/MockWIF.sol";

/// @dev 6-decimal stand-in for USDG.
contract MockUSDG is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PlayChainTipsTest is Test {
    PlayChainArcade arcade;
    PlayChainTips tips;
    MockWIF wif;
    MockUSDG usdg;

    address treasury = makeAddr("treasury");
    address dev = makeAddr("dev");
    address alice = makeAddr("alice");
    uint256 constant USD = 1e6;
    uint256 id;

    event Tipped(uint256 indexed id, address indexed from, address indexed developer, uint256 amount, uint256 toDev, uint256 toTreasury);

    function setUp() public {
        wif = new MockWIF();
        usdg = new MockUSDG();
        arcade = new PlayChainArcade(address(wif), treasury, 100e18, 100e18, 1 days);
        tips = new PlayChainTips(address(arcade), address(usdg), treasury, 1 * USD);
        wif.mint(dev, 1_000e18);
        vm.startPrank(dev);
        wif.approve(address(arcade), type(uint256).max);
        id = arcade.listGame("https://example.com/meta.json");
        vm.stopPrank();
        usdg.mint(alice, 1_000_000 * USD);
        vm.prank(alice);
        usdg.approve(address(tips), type(uint256).max);
    }

    function test_Constructor() public {
        assertEq(address(tips.arcade()), address(arcade));
        assertEq(address(tips.stable()), address(usdg));
        assertEq(tips.treasury(), treasury);
        assertEq(tips.treasuryBps(), 1_000);
        assertEq(tips.minTip(), USD);
        vm.expectRevert(PlayChainTips.ZeroAddress.selector);
        new PlayChainTips(address(0), address(usdg), treasury, 1);
        vm.expectRevert(PlayChainTips.ZeroAddress.selector);
        new PlayChainTips(address(arcade), address(0), treasury, 1);
        vm.expectRevert(PlayChainTips.ZeroAddress.selector);
        new PlayChainTips(address(arcade), address(usdg), address(0), 1);
        vm.expectRevert(PlayChainTips.InvalidSettings.selector);
        new PlayChainTips(address(arcade), address(usdg), treasury, 0);
    }

    function test_TipSplits90To10() public {
        vm.expectEmit(address(tips));
        emit Tipped(id, alice, dev, 10 * USD, 9 * USD, 1 * USD);
        vm.prank(alice);
        tips.tip(id, 10 * USD);
        assertEq(usdg.balanceOf(dev), 9 * USD);
        assertEq(usdg.balanceOf(treasury), 1 * USD);
        assertEq(usdg.balanceOf(address(tips)), 0);
        assertEq(tips.totalTips(id), 10 * USD);
        assertEq(tips.allTips(), 10 * USD);
        uint256[] memory ids = new uint256[](2);
        ids[0] = id;
        ids[1] = 99;
        uint256[] memory out = tips.getTips(ids);
        assertEq(out[0], 10 * USD);
        assertEq(out[1], 0);
    }

    function testFuzz_TipConservesFunds(uint256 amount, uint16 bps) public {
        amount = bound(amount, USD, 1_000_000 * USD);
        bps = uint16(bound(bps, 0, 2_000));
        tips.setTipSettings(USD, bps);
        vm.prank(alice);
        tips.tip(id, amount);
        assertEq(usdg.balanceOf(dev) + usdg.balanceOf(treasury), amount);
        assertEq(usdg.balanceOf(treasury), amount * bps / 10_000);
        assertEq(usdg.balanceOf(address(tips)), 0);
    }

    function test_ZeroTreasuryShareSendsAllToDev() public {
        tips.setTipSettings(USD, 0);
        vm.prank(alice);
        tips.tip(id, 5 * USD);
        assertEq(usdg.balanceOf(dev), 5 * USD);
        assertEq(usdg.balanceOf(treasury), 0);
    }

    function test_RevertsBelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainTips.TipTooSmall.selector, USD - 1, USD));
        tips.tip(id, USD - 1);
    }

    function test_RevertsForUnknownGame() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 7));
        tips.tip(7, USD);
    }

    function test_RevertsForHiddenGame() public {
        arcade.setGameActive(id, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainTips.GameInactive.selector, id));
        tips.tip(id, USD);
    }

    function test_PauseStopsTips() public {
        tips.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tips.tip(id, USD);
        tips.unpause();
        vm.prank(alice);
        tips.tip(id, USD);
    }

    function test_AdminSettings() public {
        tips.setTipSettings(2 * USD, 2_000);
        assertEq(tips.minTip(), 2 * USD);
        assertEq(tips.treasuryBps(), 2_000);
        vm.expectRevert(PlayChainTips.InvalidSettings.selector);
        tips.setTipSettings(USD, 2_001);
        vm.expectRevert(PlayChainTips.InvalidSettings.selector);
        tips.setTipSettings(0, 100);

        address t2 = makeAddr("t2");
        tips.setTreasury(t2);
        assertEq(tips.treasury(), t2);
        vm.expectRevert(PlayChainTips.ZeroAddress.selector);
        tips.setTreasury(address(0));
    }

    function test_OnlyOwnerCanAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        tips.setTipSettings(USD, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        tips.setTreasury(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        tips.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        tips.unpause();
        vm.stopPrank();
    }

    function test_TipsDontChangeTheSpotlightRace() public {
        uint256 e = arcade.currentEpoch();
        vm.prank(alice);
        tips.tip(id, 500 * USD);
        assertEq(arcade.votesInEpoch(e, id), 0);
        assertEq(arcade.getGame(id).totalVotes, 0);
    }
}
