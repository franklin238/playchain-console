// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PlayChainArcade} from "./PlayChainArcade.sol";

/// @title PlayChainTips
/// @notice Tip a PlayChain game's developer in a stablecoin (Paxos USDG). Developers get paid in
///         stable dollars, not only in $WIF. Each tip goes straight from the tipper: 90% to the
///         game's developer and 10% to the treasury by default. Nothing is burned, and the contract
///         never holds tokens. Tips don't count toward the $WIF Spotlight race.
contract PlayChainTips is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS = 10_000;
    /// @notice The treasury can never take more than 20% of a tip.
    uint16 public constant MAX_TREASURY_BPS = 2_000;

    PlayChainArcade public immutable arcade;
    IERC20 public immutable stable;

    address public treasury;
    uint16 public treasuryBps;
    uint256 public minTip;

    /// @notice All tips a game has received, in the stablecoin's base units.
    mapping(uint256 id => uint256) public totalTips;
    /// @notice All tips across every game.
    uint256 public allTips;

    event Tipped(uint256 indexed id, address indexed from, address indexed developer, uint256 amount, uint256 toDev, uint256 toTreasury);
    event TipSettingsUpdated(uint256 minTip, uint16 treasuryBps);
    event TreasuryUpdated(address treasury);

    error ZeroAddress();
    error TipTooSmall(uint256 amount, uint256 minTip);
    error GameInactive(uint256 id);
    error InvalidSettings();

    /// @param arcade_ PlayChainArcade, the source of truth for games and their developers.
    /// @param stable_ The stablecoin, e.g. USDG (6 decimals).
    /// @param treasury_ Receives the treasury share.
    /// @param minTip_ Smallest tip, in base units (1 USDG = 1_000_000).
    constructor(address arcade_, address stable_, address treasury_, uint256 minTip_) Ownable(msg.sender) {
        if (arcade_ == address(0) || stable_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (minTip_ == 0) revert InvalidSettings();
        arcade = PlayChainArcade(arcade_);
        stable = IERC20(stable_);
        treasury = treasury_;
        minTip = minTip_;
        treasuryBps = 1_000;
    }

    /// @notice Tip game `id`'s developer `amount` of the stablecoin. Approve this contract first.
    function tip(uint256 id, uint256 amount) external whenNotPaused nonReentrant {
        PlayChainArcade.Game memory g = arcade.getGame(id); // reverts for unknown ids
        if (!g.active) revert GameInactive(id);
        if (amount < minTip) revert TipTooSmall(amount, minTip);

        uint256 toTreasury = amount * treasuryBps / BPS;
        uint256 toDev = amount - toTreasury;
        totalTips[id] += amount;
        allTips += amount;

        stable.safeTransferFrom(msg.sender, g.developer, toDev);
        if (toTreasury > 0) stable.safeTransferFrom(msg.sender, treasury, toTreasury);
        emit Tipped(id, msg.sender, g.developer, amount, toDev, toTreasury);
    }

    /// @notice Tip totals for many games at once.
    function getTips(uint256[] calldata ids) external view returns (uint256[] memory out) {
        out = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) out[i] = totalTips[ids[i]];
    }

    // ------------------------------------------------------------------ admin

    /// @notice Change the smallest tip and the treasury share (at most 20%).
    function setTipSettings(uint256 minTip_, uint16 treasuryBps_) external onlyOwner {
        if (minTip_ == 0 || treasuryBps_ > MAX_TREASURY_BPS) revert InvalidSettings();
        minTip = minTip_;
        treasuryBps = treasuryBps_;
        emit TipSettingsUpdated(minTip_, treasuryBps_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
