// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayChainArcade} from "../src/PlayChainArcade.sol";
import {MockWIF} from "./mocks/MockWIF.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract PlayChainArcadeTest is Test {
    PlayChainArcade arcade;
    MockWIF wif;

    address owner = address(this);
    address treasury = makeAddr("treasury");
    address dev = makeAddr("dev");
    address dev2 = makeAddr("dev2");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    uint256 constant FEE = 1_000e18;
    uint256 constant MIN = 100e18;
    uint256 constant DAY = 86_400;
    string constant URI = "https://playchain-console.vercel.app/games/neon-tide/meta.json";

    event GameListed(uint256 indexed id, address indexed developer, string uri, uint256 feeBurned);
    event GameUpdated(uint256 indexed id, string uri);
    event GameStatusChanged(uint256 indexed id, bool active);
    event Voted(
        uint256 indexed epoch,
        uint256 indexed id,
        address indexed voter,
        uint256 amount,
        uint256 burned,
        uint256 toDev,
        uint256 toTreasury
    );
    event FeesUpdated(uint256 listingFee, uint256 minVote, uint16 burnBps, uint16 devBps, uint16 treasuryBps);
    event TreasuryUpdated(address treasury);

    function setUp() public {
        wif = new MockWIF();
        arcade = new PlayChainArcade(address(wif), treasury, FEE, MIN, DAY);
        address[4] memory users = [dev, dev2, alice, bob];
        for (uint256 i; i < users.length; ++i) {
            wif.mint(users[i], 1_000_000e18);
            vm.prank(users[i]);
            wif.approve(address(arcade), type(uint256).max);
        }
    }

    function _list(address who) internal returns (uint256) {
        vm.prank(who);
        return arcade.listGame(URI);
    }

    // ------------------------------------------------------------ constructor

    function test_constructor_defaults() public view {
        assertEq(address(arcade.wif()), address(wif));
        assertEq(arcade.treasury(), treasury);
        assertEq(arcade.listingFee(), FEE);
        assertEq(arcade.minVote(), MIN);
        assertEq(arcade.epochLength(), DAY);
        assertEq(arcade.startTime(), block.timestamp);
        assertEq(arcade.burnBps(), 3_500);
        assertEq(arcade.devBps(), 4_000);
        assertEq(arcade.treasuryBps(), 2_500);
        assertEq(arcade.owner(), owner);
    }

    function test_constructor_zeroAddressReverts() public {
        vm.expectRevert(PlayChainArcade.ZeroAddress.selector);
        new PlayChainArcade(address(0), treasury, FEE, MIN, DAY);
        vm.expectRevert(PlayChainArcade.ZeroAddress.selector);
        new PlayChainArcade(address(wif), address(0), FEE, MIN, DAY);
    }

    function test_constructor_zeroEpochOrMinVoteReverts() public {
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        new PlayChainArcade(address(wif), treasury, FEE, MIN, 0);
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        new PlayChainArcade(address(wif), treasury, FEE, 0, DAY);
    }

    // ------------------------------------------------------------ listing

    function test_list_burnsFeeAndStoresGame() public {
        uint256 before = wif.balanceOf(dev);
        vm.expectEmit(true, true, false, true);
        emit GameListed(1, dev, URI, FEE);
        uint256 id = _list(dev);
        assertEq(id, 1);
        assertEq(arcade.gameCount(), 1);
        assertEq(wif.balanceOf(BURN), FEE);
        assertEq(wif.balanceOf(dev), before - FEE);
        assertEq(wif.balanceOf(address(arcade)), 0);
        PlayChainArcade.Game memory g = arcade.getGame(1);
        assertEq(g.developer, dev);
        assertEq(g.listedAt, block.timestamp);
        assertTrue(g.active);
        assertEq(g.totalVotes, 0);
        assertEq(g.metadataURI, URI);
    }

    function test_list_idsIncrement() public {
        assertEq(_list(dev), 1);
        assertEq(_list(dev2), 2);
        assertEq(_list(dev), 3);
    }

    function test_list_zeroFeeSkipsTransfer() public {
        arcade.setFees(0, MIN, 5_000, 4_000, 1_000);
        uint256 id = _list(dev);
        assertEq(id, 1);
        assertEq(wif.balanceOf(BURN), 0);
    }

    function test_list_emptyURIReverts() public {
        vm.prank(dev);
        vm.expectRevert(PlayChainArcade.InvalidURI.selector);
        arcade.listGame("");
    }

    function test_list_longURIReverts() public {
        bytes memory b = new bytes(257);
        for (uint256 i; i < b.length; ++i) b[i] = "a";
        vm.prank(dev);
        vm.expectRevert(PlayChainArcade.InvalidURI.selector);
        arcade.listGame(string(b));
    }

    function test_list_maxURIOk() public {
        bytes memory b = new bytes(256);
        for (uint256 i; i < b.length; ++i) b[i] = "a";
        vm.prank(dev);
        arcade.listGame(string(b));
        assertEq(arcade.gameCount(), 1);
    }

    function test_list_noAllowanceReverts() public {
        address carol = makeAddr("carol");
        wif.mint(carol, FEE);
        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(arcade), 0, FEE)
        );
        arcade.listGame(URI);
    }

    function test_list_pausedReverts() public {
        arcade.pause();
        vm.prank(dev);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arcade.listGame(URI);
    }

    // ------------------------------------------------------------ updating

    function test_update_byDeveloper() public {
        _list(dev);
        string memory u2 = "https://example.com/meta2.json";
        vm.expectEmit(true, false, false, true);
        emit GameUpdated(1, u2);
        vm.prank(dev);
        arcade.updateGame(1, u2);
        assertEq(arcade.getGame(1).metadataURI, u2);
    }

    function test_update_byOtherReverts() public {
        _list(dev);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.NotDeveloper.selector, 1));
        arcade.updateGame(1, URI);
    }

    function test_update_badURIReverts() public {
        _list(dev);
        vm.prank(dev);
        vm.expectRevert(PlayChainArcade.InvalidURI.selector);
        arcade.updateGame(1, "");
    }

    function test_update_unknownReverts() public {
        vm.prank(dev);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 7));
        arcade.updateGame(7, URI);
    }

    // ------------------------------------------------------------ voting

    function test_vote_split_35_40_25() public {
        _list(dev);
        uint256 burnBefore = wif.balanceOf(BURN);
        uint256 devBefore = wif.balanceOf(dev);
        uint256 aliceBefore = wif.balanceOf(alice);
        vm.expectEmit(true, true, true, true);
        emit Voted(0, 1, alice, 300e18, 105e18, 120e18, 75e18);
        vm.prank(alice);
        arcade.vote(1, 300e18);
        assertEq(wif.balanceOf(BURN) - burnBefore, 105e18);
        assertEq(wif.balanceOf(dev) - devBefore, 120e18);
        assertEq(wif.balanceOf(treasury), 75e18);
        assertEq(aliceBefore - wif.balanceOf(alice), 300e18);
        assertEq(wif.balanceOf(address(arcade)), 0);
        assertEq(arcade.getGame(1).totalVotes, 300e18);
        assertEq(arcade.votesInEpoch(0, 1), 300e18);
        assertEq(arcade.totalVotesInEpoch(0), 300e18);
    }

    function test_vote_roundingRemainderBurns() public {
        arcade.setFees(FEE, 1, 5_000, 4_000, 1_000);
        _list(dev);
        uint256 burnBefore = wif.balanceOf(BURN);
        vm.prank(alice);
        arcade.vote(1, 101); // dev 40.4 -> 40, treasury 10.1 -> 10, burn 51
        assertEq(wif.balanceOf(BURN) - burnBefore, 51);
        assertEq(wif.balanceOf(treasury), 10);
        assertEq(wif.balanceOf(dev), 1_000_000e18 - FEE + 40);
    }

    function test_vote_selfVoteBurnsDevShare() public {
        _list(dev);
        uint256 burnBefore = wif.balanceOf(BURN);
        uint256 devBefore = wif.balanceOf(dev);
        vm.expectEmit(true, true, true, true);
        emit Voted(0, 1, dev, 200e18, 150e18, 0, 50e18);
        vm.prank(dev);
        arcade.vote(1, 200e18);
        assertEq(wif.balanceOf(BURN) - burnBefore, 150e18);
        assertEq(devBefore - wif.balanceOf(dev), 200e18);
        assertEq(wif.balanceOf(treasury), 50e18);
    }

    function test_vote_zeroLegsSkipped() public {
        // tiny vote where dev and treasury shares round to 0
        arcade.setFees(FEE, 1, 8_000, 0, 2_000);
        _list(dev);
        vm.prank(alice);
        arcade.vote(1, 1); // treasury 0.2 -> 0, dev 0, burn 1
        assertEq(wif.balanceOf(treasury), 0);
        assertEq(wif.balanceOf(BURN), FEE + 1);
    }

    function test_vote_belowMinReverts() public {
        _list(dev);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.VoteTooSmall.selector, MIN - 1, MIN));
        arcade.vote(1, MIN - 1);
    }

    function test_vote_unknownReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 0));
        arcade.vote(0, MIN);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 1));
        arcade.vote(1, MIN);
    }

    function test_vote_inactiveReverts() public {
        _list(dev);
        arcade.setGameActive(1, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameInactive.selector, 1));
        arcade.vote(1, MIN);
    }

    function test_vote_pausedReverts() public {
        _list(dev);
        arcade.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        arcade.vote(1, MIN);
        arcade.unpause();
        vm.prank(alice);
        arcade.vote(1, MIN);
    }

    function test_vote_insufficientBalanceReverts() public {
        _list(dev);
        address carol = makeAddr("carol");
        wif.mint(carol, 10e18);
        vm.prank(carol);
        wif.approve(address(arcade), type(uint256).max);
        vm.prank(carol);
        vm.expectRevert();
        arcade.vote(1, MIN);
    }

    function test_vote_insufficientAllowanceReverts() public {
        _list(dev);
        address carol = makeAddr("carol");
        wif.mint(carol, 1_000e18);
        vm.prank(carol);
        wif.approve(address(arcade), MIN - 1);
        vm.prank(carol);
        vm.expectRevert();
        arcade.vote(1, MIN);
    }

    // ------------------------------------------------------------ epochs

    function test_epoch_startsAtZeroAndRolls() public {
        assertEq(arcade.currentEpoch(), 0);
        assertEq(arcade.epochEndsAt(0), arcade.startTime() + DAY);
        vm.warp(block.timestamp + DAY - 1);
        assertEq(arcade.currentEpoch(), 0);
        vm.warp(block.timestamp + 1);
        assertEq(arcade.currentEpoch(), 1);
        assertEq(arcade.epochEndsAt(1), arcade.startTime() + 2 * DAY);
    }

    function test_epoch_votesLandInRightEpoch() public {
        _list(dev);
        vm.prank(alice);
        arcade.vote(1, MIN);
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        arcade.vote(1, 2 * MIN);
        assertEq(arcade.votesInEpoch(0, 1), MIN);
        assertEq(arcade.votesInEpoch(1, 1), 2 * MIN);
        assertEq(arcade.getGame(1).totalVotes, 3 * MIN);
    }

    // ------------------------------------------------------------ leader

    function test_leader_firstVoteSets() public {
        _list(dev);
        vm.prank(alice);
        arcade.vote(1, MIN);
        assertEq(arcade.leaderOf(0), 1);
        assertEq(arcade.leaderVotes(0), MIN);
    }

    function test_leader_largerTotalTakesOver_equalDoesNot() public {
        _list(dev);
        _list(dev2);
        vm.prank(alice);
        arcade.vote(1, 200e18);
        vm.prank(bob);
        arcade.vote(2, 200e18); // equal: no takeover
        assertEq(arcade.leaderOf(0), 1);
        vm.prank(bob);
        arcade.vote(2, 100e18); // 300 > 200
        assertEq(arcade.leaderOf(0), 2);
        assertEq(arcade.leaderVotes(0), 300e18);
        vm.prank(alice);
        arcade.vote(1, 100e18); // 300 == 300: no takeover
        assertEq(arcade.leaderOf(0), 2);
    }

    function test_leader_perEpochIndependent() public {
        _list(dev);
        _list(dev2);
        vm.prank(alice);
        arcade.vote(1, 500e18);
        vm.warp(block.timestamp + DAY);
        vm.prank(bob);
        arcade.vote(2, MIN);
        assertEq(arcade.leaderOf(0), 1);
        assertEq(arcade.leaderOf(1), 2);
        assertEq(arcade.leaderOf(2), 0);
    }

    // ------------------------------------------------------------ admin

    function test_setFees_ok() public {
        vm.expectEmit(false, false, false, true);
        emit FeesUpdated(5e18, 1e18, 6_000, 2_000, 2_000);
        arcade.setFees(5e18, 1e18, 6_000, 2_000, 2_000);
        assertEq(arcade.listingFee(), 5e18);
        assertEq(arcade.minVote(), 1e18);
        assertEq(arcade.burnBps(), 6_000);
        assertEq(arcade.devBps(), 2_000);
        assertEq(arcade.treasuryBps(), 2_000);
    }

    function test_setFees_capsEnforced() public {
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        arcade.setFees(FEE, MIN, 5_000, 4_000, 999); // sum != 10000
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        arcade.setFees(FEE, MIN, 2_000, 3_900, 4_100); // treasury > 40%
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        arcade.setFees(FEE, MIN, 1_999, 6_001, 2_000); // burn < 20%
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        arcade.setFees(FEE, 0, 5_000, 4_000, 1_000); // minVote 0
        vm.expectRevert(PlayChainArcade.InvalidFees.selector);
        arcade.setFees(FEE, MIN, type(uint16).max, type(uint16).max, 2); // overflow-safe sum
    }

    function test_setFees_treasuryUpTo40() public {
        arcade.setFees(FEE, MIN, 2_000, 4_000, 4_000); // 20 / 40 / 40: the most the treasury can take
        _list(dev);
        uint256 devBefore = wif.balanceOf(dev);
        vm.prank(alice);
        arcade.vote(1, 300e18);
        assertEq(wif.balanceOf(treasury), 120e18);
        assertEq(wif.balanceOf(dev) - devBefore, 120e18);
    }

    function test_admin_nonOwnerReverts() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.setFees(FEE, MIN, 5_000, 4_000, 1_000);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.setTreasury(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.setGameActive(1, false);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arcade.unpause();
        vm.stopPrank();
    }

    function test_ownable2Step_transfer() public {
        arcade.transferOwnership(alice);
        assertEq(arcade.owner(), owner);
        assertEq(arcade.pendingOwner(), alice);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        arcade.acceptOwnership();
        vm.prank(alice);
        arcade.acceptOwnership();
        assertEq(arcade.owner(), alice);
    }

    function test_setTreasury() public {
        vm.expectRevert(PlayChainArcade.ZeroAddress.selector);
        arcade.setTreasury(address(0));
        vm.expectEmit(false, false, false, true);
        emit TreasuryUpdated(bob);
        arcade.setTreasury(bob);
        assertEq(arcade.treasury(), bob);
    }

    function test_setGameActive_toggles() public {
        _list(dev);
        vm.expectEmit(true, false, false, true);
        emit GameStatusChanged(1, false);
        arcade.setGameActive(1, false);
        assertFalse(arcade.getGame(1).active);
        arcade.setGameActive(1, true);
        assertTrue(arcade.getGame(1).active);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 2));
        arcade.setGameActive(2, true);
    }

    // ------------------------------------------------------------ views

    function test_getGame_bounds() public {
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 0));
        arcade.getGame(0);
        _list(dev);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 2));
        arcade.getGame(2);
    }

    function test_getGames_paginationAndCap() public {
        assertEq(arcade.getGames(0, 10).length, 0);
        arcade.setFees(0, MIN, 5_000, 4_000, 1_000);
        for (uint256 i; i < 105; ++i) _list(i % 2 == 0 ? dev : dev2);
        arcade.setGameActive(3, false);
        PlayChainArcade.Game[] memory page = arcade.getGames(0, 500);
        assertEq(page.length, 100);
        assertEq(page[0].developer, dev);
        assertEq(page[1].developer, dev2);
        assertFalse(page[2].active); // inactive included
        PlayChainArcade.Game[] memory rest = arcade.getGames(100, 100);
        assertEq(rest.length, 5);
        assertEq(arcade.getGames(2, 3).length, 3);
        assertEq(arcade.getGames(105, 10).length, 0);
        assertEq(arcade.getGames(200, 10).length, 0);
    }

    function test_getEpochVotes_batch() public {
        _list(dev);
        _list(dev2);
        vm.prank(alice);
        arcade.vote(1, 150e18);
        vm.prank(bob);
        arcade.vote(2, 250e18);
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;
        uint256[] memory v = arcade.getEpochVotes(0, ids);
        assertEq(v[0], 150e18);
        assertEq(v[1], 250e18);
        assertEq(v[2], 0);
    }

    function test_previewSplit_matchesTransfers() public {
        _list(dev);
        (uint256 b, uint256 d, uint256 t) = arcade.previewSplit(alice, 1, 333e18);
        uint256 burnBefore = wif.balanceOf(BURN);
        uint256 devBefore = wif.balanceOf(dev);
        vm.prank(alice);
        arcade.vote(1, 333e18);
        assertEq(wif.balanceOf(BURN) - burnBefore, b);
        assertEq(wif.balanceOf(dev) - devBefore, d);
        assertEq(wif.balanceOf(treasury), t);
        (b, d, t) = arcade.previewSplit(dev, 1, 100e18);
        assertEq(d, 0);
        assertEq(b, 75e18);
        assertEq(t, 25e18);
        vm.expectRevert(abi.encodeWithSelector(PlayChainArcade.GameNotFound.selector, 9));
        arcade.previewSplit(alice, 9, 1);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_splitConserves(uint256 amount, uint16 burnBps, uint16 treasuryBps, bool selfVote) public {
        treasuryBps = uint16(bound(treasuryBps, 0, 4_000));
        burnBps = uint16(bound(burnBps, 2_000, 10_000 - treasuryBps));
        uint16 devBps = 10_000 - burnBps - treasuryBps;
        amount = bound(amount, 1, 900_000e18);
        arcade.setFees(FEE, 1, burnBps, devBps, treasuryBps);
        _list(dev);
        address voter = selfVote ? dev : alice;
        (uint256 b, uint256 d, uint256 t) = arcade.previewSplit(voter, 1, amount);
        assertEq(b + d + t, amount);
        uint256 vBefore = wif.balanceOf(voter);
        uint256 burnBefore = wif.balanceOf(BURN);
        uint256 devBefore = wif.balanceOf(dev);
        vm.prank(voter);
        arcade.vote(1, amount);
        assertEq(vBefore - wif.balanceOf(voter), selfVote ? amount - d : amount);
        assertEq(wif.balanceOf(BURN) - burnBefore, b);
        if (!selfVote) assertEq(wif.balanceOf(dev) - devBefore, d);
        assertEq(wif.balanceOf(treasury), t);
        assertEq(wif.balanceOf(address(arcade)), 0);
    }
}
