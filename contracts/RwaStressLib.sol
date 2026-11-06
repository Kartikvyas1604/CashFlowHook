// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title RwaStressLib
/// @notice Closed-form RWA stress terms + margin segregation (spec §6.2).
///         lossR1 carries the weekend/overnight gap premium because tokenized
///         stocks trade 24/7 while the underlying trades market hours
///         (spec §4.2, GAP_PREMIUM). Pure; no external calls.
library RwaStressLib {
    uint256 public constant WAD = 1e18;
    uint256 public constant GAP_PREMIUM = 0.5e18; // +50% on worst shock loss [assumption per spec]
    uint256 public constant PERM_LIQ_HC = 0.015e18; // 1.5% of NAV [assumption per spec]
    uint256 public constant EXIT_COST_FRAC = 0.005e18; // 0.5% NAV cap [assumption per spec]
    uint256 public constant GATE_DAYS = 2;
    uint256 public constant DAILY_CAP_PER_INVESTOR = 25_000_000e18; // USDC-WAD, verified (docs/rwa-sources.md)
    uint256 public constant ALL_INVESTORS_CAP = 50_000_000e18; // USDC-WAD, verified
    uint256 public constant CAP_FRACTION = 0.25e18; // eligibility threshold = 25% of the daily per-investor cap
    uint256 public constant HC_R1 = 0.75e18;
    uint256 public constant HC_R2 = 0.85e18;
    uint256 public constant NAV_STALENESS = 93_600; // 26h (daily NAV + slack)

    /// @dev lossR1 = equityRwaUsd · max(0, −sh_20) · (1 + GAP_PREMIUM)
    ///      worst gated shock magnitude = 0.20, premium 1.5×, WAD-rated.
    function lossR1(uint256 equityRwaUsd) internal pure returns (uint256) {
        // usd · 0.20 · (1 + 0.5), all WAD-fixed-point
        return (equityRwaUsd * (0.20e18 * (WAD + GAP_PREMIUM))) / (WAD * WAD);
    }

    /// @dev lossR2 = navUsd · PERM_LIQ_HC + min(navUsd · 0.5%, dailyCoupon · GATE_DAYS)
    function lossR2(uint256 navUsd, uint256 dailyCoupon)
        internal
        pure
        returns (uint256)
    {
        uint256 permLiquidation = (navUsd * PERM_LIQ_HC) / WAD;
        uint256 exitCost = navUsd * EXIT_COST_FRAC / WAD;
        uint256 gateCost = dailyCoupon * GATE_DAYS;
        if (gateCost < exitCost) exitCost = gateCost;
        return permLiquidation + exitCost;
    }

    /// @dev R2 NAV value = shared amount × NAV per share (both WAD)
    function navValue(uint256 navAmount, uint256 navPerShare) internal pure returns (uint256) {
        return (navAmount * navPerShare) / WAD;
    }

    /// @dev eligibility flags per §4.3:
    ///      eligR1 = transferRestricted ? 0 : 1        (I11)
    ///      eligR2 = (gateOpen && navFresh && under cap) ? 1 : 0
    function eligibility(bool transferRestricted, bool gateOpen, uint256 navUsd, uint256 navStaleSeconds)
        internal
        pure
        returns (uint8 eligR1, uint8 eligR2)
    {
        eligR1 = transferRestricted ? uint8(0) : uint8(1);
        bool underDailyCap = navUsd <= (DAILY_CAP_PER_INVESTOR * CAP_FRACTION) / WAD; // $6.25M per-account eligible value
        eligR2 = (gateOpen && navStaleSeconds <= NAV_STALENESS && underDailyCap)
            ? uint8(1)
            : uint8(0);
    }

    /// @dev unwindableNow vs earningLocked — the v3 core.
    function segregated(
        uint256 stockUsdHc,
        uint256 lpUsdHc,
        uint256 r1UsdHc,
        uint256 r2UsdHc,
        uint8 eligR1,
        uint8 eligR2
    )
        internal
        pure
        returns (uint256 unwindableNow, uint256 earningLocked)
    {
        uint256 total = stockUsdHc + lpUsdHc + r1UsdHc + r2UsdHc;
        uint256 unwindable = stockUsdHc + lpUsdHc + r1UsdHc * eligR1 + r2UsdHc * eligR2;
        unwindableNow = unwindable;
        earningLocked = total - unwindable;
    }
}
