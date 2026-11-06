// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MarkOracle — signed marks for tokenized equities (ST / R1 legs).
/// @notice Trusted-signer MVP exactly as specified (§6.3/§6.5): the backend
///         service reads REAL prices (Ondo GM API for tokenized stocks) and
///         posts them with its dedicated hot key. Every record pins the
///         observed timestamp so staleness reverts are auditable. Production
///         hardening beyond MVP (multi-oracle consensus) is documented in
///         docs/limits.md.
contract MarkOracle {
    struct Mark {
        uint256 priceWad; // USD per share, WAD
        uint64 observedAt; // seconds
        uint64 postedAt;
        bytes32 sourceDigest; // sha256 of the raw API response used
    }

    mapping(address => Mark) public marks;
    mapping(address => bool) public knownAsset;
    address public owner;
    address public signer;

    error NotSigner();
    error NotOwner();
    error EmptyAsset();
    error StaleObserved();
    error TooSoon();

    event MarkPosted(address indexed asset, uint256 priceWad, uint64 observedAt, bytes32 sourceDigest);

    constructor(address initialSigner) {
        owner = msg.sender;
        signer = initialSigner;
    }

    function setSigner(address s) external {
        if (msg.sender != owner) revert NotOwner();
        signer = s;
    }

    /// @notice Post a fresh, real-source mark.
    /// @dev observedAt must strictly increase per asset (I9; no silent repaint).
    function postMark(address asset, uint256 priceWad, uint64 observedAt, bytes32 sourceDigest) external {
        if (msg.sender != signer) revert NotSigner();
        if (asset == address(0)) revert EmptyAsset();
        Mark storage m = marks[asset];
        if (observedAt <= m.observedAt) revert StaleObserved();
        m.priceWad = priceWad;
        m.observedAt = observedAt;
        m.postedAt = uint64(block.timestamp);
        m.sourceDigest = sourceDigest;
        if (!knownAsset[asset]) knownAsset[asset] = true;
        emit MarkPosted(asset, priceWad, observedAt, sourceDigest);
    }

    /// @return priceWad (0 if never posted)
    /// @return staleSeconds age of the observedAt vs now
    function mark(address asset) external view returns (uint256 priceWad, uint256 staleSeconds) {
        Mark storage m = marks[asset];
        return (m.priceWad, uint256(block.timestamp) > m.observedAt ? uint256(block.timestamp) - m.observedAt : 0);
    }
}
