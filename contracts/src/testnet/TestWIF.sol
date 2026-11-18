// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestWIF
/// @notice Stand-in for $WIF on Robinhood Chain Testnet, where the real token doesn't exist.
///         It has no value. Anyone can take 5,000 from the faucet once an hour, so judges and
///         players can try voting. It refuses to deploy on Robinhood Chain mainnet.
contract TestWIF is ERC20 {
    uint256 public constant MAINNET_CHAIN_ID = 4663;
    uint256 public constant DRIP = 5_000 ether;
    uint256 public constant COOLDOWN = 1 hours;

    /// @notice When each address last used the faucet.
    mapping(address => uint256) public lastDrip;

    error MainnetNotAllowed();
    error FaucetCooldown(uint256 nextAt);

    /// @param initialSupply minted to the deployer, used to list the games and seed the first votes
    constructor(uint256 initialSupply) ERC20("Test WIF (PlayChain testnet)", "tWIF") {
        if (block.chainid == MAINNET_CHAIN_ID) revert MainnetNotAllowed();
        _mint(msg.sender, initialSupply);
    }

    /// @notice Sends 5,000 tWIF to the caller, once per hour per address.
    function faucet() external {
        uint256 last = lastDrip[msg.sender];
        if (last != 0 && block.timestamp < last + COOLDOWN) revert FaucetCooldown(last + COOLDOWN);
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, DRIP);
    }
}
