// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title FeeStreamOracle — LP positions' real fee streams (truncated window).
/// @notice Trusted-signer MVP (§6.3/§6.6): the indexer service reads REAL
///         Swap events for a real Uniswap position on-chain, excludes the
///         account owner (Sybil filter), hashes the taker sample, and posts
///         the signed record. The on-chain store is the availability/correctness
///         gate for the fee-credit term; takers < 5 zeroes the credit (I6).
contract FeeStreamOracle {
    struct Stream {
        bool exists;
        uint256 avgDailyFeesWad; // USD-WAD per day over the 7d window
        uint256 distinctTakers;
        uint64 windowStartTs;
        uint64 observedAt;
        bytes32 sampleRoot; // keccak of the sorted taker sample
    }

    mapping(uint256 => Stream) public streams; // key = positionKey
    address public owner;
    address public signer;

    error NotSigner();
    error NotOwner();
    error TooSoon();

    event StreamRecorded(uint256 indexed positionKey, uint256 avgDailyFeesWad, uint256 takers, uint64 observedAt);

    constructor(address initialSigner) {
        owner = msg.sender;
        signer = initialSigner;
    }

    function setSigner(address s) external {
        if (msg.sender != owner) revert NotOwner();
        signer = s;
    }

    /// @notice Post a fresh stream record for a REAL LP position key.
    /// @dev observedAt must strictly increase per key (I5-analog: append-only).
    function postStream(uint256 positionKey, uint256 avgDailyFeesWad, uint256 distinctTakers, uint64 windowStartTs, uint64 observedAt, bytes32 sampleRoot)
        external
    {
        if (msg.sender != signer) revert NotSigner();
        Stream storage s = streams[positionKey];
        if (observedAt <= s.observedAt) revert TooSoon();
        s.exists = true;
        s.avgDailyFeesWad = avgDailyFeesWad;
        s.distinctTakers = distinctTakers;
        s.windowStartTs = windowStartTs;
        s.observedAt = observedAt;
        s.sampleRoot = sampleRoot;
        emit StreamRecorded(positionKey, avgDailyFeesWad, distinctTakers, observedAt);
    }

    /// @notice The engine's LP-leg snapshot (spec §6.1 fee credit inputs).
    function lpSnapshot(uint256 positionKey, address /* excludedOwner (enforced by indexer) */)
        external
        view
        returns (bool exists, uint256 lpUsdWad, uint256 avgDailyFeesWad, uint256 distinctTakers, uint64 observedAt)
    {
        Stream storage s = streams[positionKey];
        return (s.exists, 0, s.avgDailyFeesWad, s.distinctTakers, s.observedAt);
        // lpUsdWad is supplied by the engine from the position's own mark
        // (the LP USD value = principal + fees at current pool rates) and the
        // fee feed here is exactly what the credit term needs.
    }
}
