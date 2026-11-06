// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev Minimal token + oracle interfaces used by the engine — no
/// external dependency trees; callers self-verify decimals at attach time.

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface INavSource {
    /// @return priceWad — NAV per share in WAD (e.g. USDYOracleWrapper.getPrice())
    /// @return lastUpdateTs — donor update time (seconds), staleness input
    function priceData() external view returns (uint256 priceWad, uint64 lastUpdateTs);
}

interface IMarkSource {
    /// @return priceWad — USD per share, WAD
    /// @return lastUpdateTs — source update time, seconds (staleness input)
    function markData() external view returns (uint256 priceWad, uint64 lastUpdateTs);
}

interface ILpPositionSource {
    /// @notice A real LP position: id, pool, and the USD value + 7d fee accrual snapshot.
    struct LpSnapshot {
        bool exists;
        uint256 lpUsd; // WAD
        uint256 avg7dFeesUsd; // WAD per day
        uint256 distinctTakers; // ≥5 gates fee credit (I6)
        uint64 lastUpdateTs;
    }
    function lpSnapshot(uint256 positionKey, address excludedOwner)
        external
        view
        returns (LpSnapshot memory);
}
