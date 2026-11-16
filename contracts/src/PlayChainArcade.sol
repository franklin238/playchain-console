// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PlayChainArcade
/// @notice Game listings and daily Spotlight voting paid in $WIF on Robinhood Chain.
///         Listing fees burn in full. Every vote is split between a burn, the game's
///         developer and the platform treasury. The contract never holds tokens:
///         every transfer goes straight from the caller to its destination.
contract PlayChainArcade is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BURN = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_TREASURY_BPS = 4_000;
    uint16 public constant MIN_BURN_BPS = 2_000;
    uint256 public constant MAX_URI_LENGTH = 256;
    uint256 public constant MAX_PAGE = 100;

    IERC20 public immutable wif;
    uint256 public immutable startTime;
    uint256 public immutable epochLength;

    address public treasury;
    uint256 public listingFee;
    uint256 public minVote;
    uint16 public burnBps;
    uint16 public devBps;
    uint16 public treasuryBps;

    struct Game {
        address developer;
        uint64 listedAt;
        bool active;
        uint256 totalVotes;
        string metadataURI;
    }

    uint256 public gameCount;
    mapping(uint256 => Game) private _games;

    mapping(uint256 => mapping(uint256 => uint256)) public votesInEpoch;
    mapping(uint256 => uint256) public leaderOf;
    mapping(uint256 => uint256) public leaderVotes;
    mapping(uint256 => uint256) public totalVotesInEpoch;

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

    error ZeroAddress();
    error InvalidURI();
    error GameNotFound(uint256 id);
    error GameInactive(uint256 id);
    error NotDeveloper(uint256 id);
    error VoteTooSmall(uint256 amount, uint256 minVote);
    error InvalidFees();

    /// @param wif_ The $WIF token.
    /// @param treasury_ Wallet that receives the treasury share of each vote.
    /// @param listingFee_ $WIF (base units) burned to list a game.
    /// @param minVote_ Smallest vote accepted, in base units.
    /// @param epochLength_ Seconds per Spotlight epoch. Immutable.
    constructor(address wif_, address treasury_, uint256 listingFee_, uint256 minVote_, uint256 epochLength_)
        Ownable(msg.sender)
    {
        if (wif_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (epochLength_ == 0 || minVote_ == 0) revert InvalidFees();
        wif = IERC20(wif_);
        treasury = treasury_;
        listingFee = listingFee_;
        minVote = minVote_;
        epochLength = epochLength_;
        startTime = block.timestamp;
        burnBps = 3_500;
        devBps = 4_000;
        treasuryBps = 2_500;
    }

    // ------------------------------------------------------------------ games

    /// @notice List a game. Burns `listingFee` $WIF from the caller.
    /// @param uri HTTPS URL of the game's meta.json, 1 to 256 bytes.
    /// @return id The new game id, starting at 1.
    function listGame(string calldata uri) external whenNotPaused nonReentrant returns (uint256 id) {
        _checkURI(uri);
        id = ++gameCount;
        _games[id] = Game({
            developer: msg.sender,
            listedAt: uint64(block.timestamp),
            active: true,
            totalVotes: 0,
            metadataURI: uri
        });
        uint256 fee = listingFee;
        if (fee > 0) wif.safeTransferFrom(msg.sender, BURN, fee);
        emit GameListed(id, msg.sender, uri, fee);
    }

    /// @notice Point a game at a new metadata URI. Only its developer can do this.
    function updateGame(uint256 id, string calldata uri) external {
        Game storage g = _existing(id);
        if (g.developer != msg.sender) revert NotDeveloper(id);
        _checkURI(uri);
        g.metadataURI = uri;
        emit GameUpdated(id, uri);
    }

    // ------------------------------------------------------------------ votes

    /// @notice Vote for a game with $WIF. Burn, developer and treasury shares
    ///         move straight from the voter. A developer voting for their own
    ///         game burns the developer share instead.
    function vote(uint256 id, uint256 amount) external whenNotPaused nonReentrant {
        Game storage g = _existing(id);
        if (!g.active) revert GameInactive(id);
        if (amount < minVote) revert VoteTooSmall(amount, minVote);

        (uint256 burned, uint256 toDev, uint256 toTreasury) = _split(msg.sender, g.developer, amount);

        uint256 e = currentEpoch();
        uint256 newTotal = votesInEpoch[e][id] + amount;
        votesInEpoch[e][id] = newTotal;
        totalVotesInEpoch[e] += amount;
        g.totalVotes += amount;
        if (newTotal > leaderVotes[e]) {
            leaderVotes[e] = newTotal;
            leaderOf[e] = id;
        }

        if (burned > 0) wif.safeTransferFrom(msg.sender, BURN, burned);
        if (toDev > 0) wif.safeTransferFrom(msg.sender, g.developer, toDev);
        if (toTreasury > 0) wif.safeTransferFrom(msg.sender, treasury, toTreasury);

        emit Voted(e, id, msg.sender, amount, burned, toDev, toTreasury);
    }

    // ------------------------------------------------------------------ views

    /// @notice Index of the current epoch, starting at 0.
    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - startTime) / epochLength;
    }

    /// @notice Timestamp at which epoch `e` ends.
    function epochEndsAt(uint256 e) external view returns (uint256) {
        return startTime + (e + 1) * epochLength;
    }

    /// @notice One game. Reverts for id 0 or ids above gameCount.
    function getGame(uint256 id) external view returns (Game memory) {
        return _existingView(id);
    }

    /// @notice Up to `limit` (max 100) games starting at id `offset + 1`, inactive ones included.
    function getGames(uint256 offset, uint256 limit) external view returns (Game[] memory list) {
        if (limit > MAX_PAGE) limit = MAX_PAGE;
        uint256 count = gameCount;
        if (offset >= count) return new Game[](0);
        uint256 n = count - offset;
        if (n > limit) n = limit;
        list = new Game[](n);
        for (uint256 i; i < n; ++i) {
            list[i] = _games[offset + i + 1];
        }
    }

    /// @notice Votes in epoch `e` for each id in `ids`.
    function getEpochVotes(uint256 e, uint256[] calldata ids) external view returns (uint256[] memory out) {
        out = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            out[i] = votesInEpoch[e][ids[i]];
        }
    }

    /// @notice How a vote of `amount` from `voter` for game `id` would be split.
    function previewSplit(address voter, uint256 id, uint256 amount)
        external
        view
        returns (uint256 burned, uint256 toDev, uint256 toTreasury)
    {
        return _split(voter, _existingView(id).developer, amount);
    }

    // ------------------------------------------------------------------ admin

    /// @notice Change prices and the vote split, within hard caps.
    function setFees(uint256 listingFee_, uint256 minVote_, uint16 burnBps_, uint16 devBps_, uint16 treasuryBps_)
        external
        onlyOwner
    {
        if (
            uint256(burnBps_) + devBps_ + treasuryBps_ != BPS || treasuryBps_ > MAX_TREASURY_BPS
                || burnBps_ < MIN_BURN_BPS || minVote_ == 0
        ) revert InvalidFees();
        listingFee = listingFee_;
        minVote = minVote_;
        burnBps = burnBps_;
        devBps = devBps_;
        treasuryBps = treasuryBps_;
        emit FeesUpdated(listingFee_, minVote_, burnBps_, devBps_, treasuryBps_);
    }

    /// @notice Change the treasury wallet.
    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Hide or restore a listing (moderation only).
    function setGameActive(uint256 id, bool active) external onlyOwner {
        _existing(id).active = active;
        emit GameStatusChanged(id, active);
    }

    /// @notice Stop listing and voting. Views keep working.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume listing and voting.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ------------------------------------------------------------------ internal

    function _split(address voter, address dev, uint256 amount)
        internal
        view
        returns (uint256 burned, uint256 toDev, uint256 toTreasury)
    {
        toDev = amount * devBps / BPS;
        toTreasury = amount * treasuryBps / BPS;
        if (voter == dev) toDev = 0;
        burned = amount - toDev - toTreasury;
    }

    function _checkURI(string calldata uri) internal pure {
        uint256 len = bytes(uri).length;
        if (len == 0 || len > MAX_URI_LENGTH) revert InvalidURI();
    }

    function _existing(uint256 id) internal view returns (Game storage) {
        if (id == 0 || id > gameCount) revert GameNotFound(id);
        return _games[id];
    }

    function _existingView(uint256 id) internal view returns (Game memory) {
        if (id == 0 || id > gameCount) revert GameNotFound(id);
        return _games[id];
    }
}
