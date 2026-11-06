// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ReceiptsRegistry — one receipt per agent spend (charge-back proof).
contract ReceiptsRegistry {
    struct Receipt {
        address account;
        address to;
        uint256 amountUsdc; // in USDC units (6dp)
        string memo;
        uint64 ts;
        address by; // the transacting identity
    }

    mapping(uint256 => Receipt) public receipts;
    uint256 public count;
    address public owner;

    error NotAuthorized();
    error BadMemo();

    event AgentSpent(uint256 indexed receiptId, address indexed account, address indexed to, uint256 amountUsdc, string memo, uint64 ts, address by);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice record a spend. Called by the engine (agent draws repaid via
    ///         x402 flows) or by the engine's authorized payer.
    /// @param to the vendor's address (real bill → real payee)
    /// @param amountUsdc in the underlying token's smallest unit (6dp for USDC)
    /// @param memo WHAT the spend bought (kept on-chain for audit)
    function record(address account, address to, uint256 amountUsdc, string calldata memo, address by) external onlyOwner {
        if (account == address(0) || to == address(0)) revert NotAuthorized();
        uint256 id = count;
        receipts[id] = Receipt(account, to, amountUsdc, memo, uint64(block.timestamp), by);
        count = id + 1;
        emit AgentSpent(id, account, to, amountUsdc, memo, uint64(block.timestamp), by);
    }
}
