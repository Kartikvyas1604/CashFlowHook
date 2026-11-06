// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title SpanMathLib
/// @notice Canonical SPAN grid math for the two same-chain legs (equity + LP),
///         mirrored byte-identically in TypeScript (lib/mirror/wad-mirror.ts).
///         Pure, no storage, no external calls (spec §6.1). WAD = 1e18.
/// @dev Rounding per spec §4.6: floor on collateral/health/accrual, ceil on debt.
library SpanMathLib {
    // ─────────────────────────── types ───────────────────────────

    struct Legs {
        uint256 stockUsd; // WAD USD value of the equity token leg
        uint256 lpUsd; // WAD USD value of the LP strategy leg
        uint256 feeCreditBase; // WAD combined (LP fees + NAV accrual) credit
        bool nonEmpty;
    }

    // ────────────────────────── constants ─────────────────────────
    // §6.1: these live exactly once, here.

    int256 public constant SHOCK_20_DOWN = -0.20e18;
    uint256 public constant VOL_STATE_HI = 1.5e18;
    uint256 public constant HC_STOCK = 0.85e18;
    uint256 public constant HC_LP = 0.70e18;
    uint256 public constant HC_R1 = 0.75e18;
    uint256 public constant HC_R2 = 0.85e18;
    uint256 public constant LTV_MAX = 0.80e18;
    uint256 public constant MAINT = 0.85e18;
    uint256 public constant LP_BETA = 0.8e18;
    uint256 public constant LP_CONVEXITY = 0.05e18;
    uint256 public constant GRIDS = 8; // shocks
    uint256 public constant VOLS = 2; // vol states
    uint256 public constant SCENARIOS = GRIDS * VOLS;
    uint256 public constant WAD = 1e18;

    // ─────────────────────────── math ────────────────────────────

    /// @dev sh_i = S[i] · V[j], S = ±{2,5,10,20}%, V = {1.0, 1.5}
    function scaledShock(uint256 i, uint256 j) internal pure returns (int256) {
        require(i < GRIDS && j < VOLS, "grid-idx");
        int256 mag = _shockMagnitude(i);
        // vol multiplier halves the sign in the negative half (all our
        // scenario shocks apply symmetrically, so scale both sides).
        return (mag * int256(j == 0 ? WAD : VOL_STATE_HI)) / int256(WAD);
    }

    function _shockMagnitude(uint256 i) private pure returns (int256) {
        // S = [-0.20, -0.10, -0.05, -0.02, +0.02, +0.05, +0.10, +0.20]
        if (i == 0) return SHOCK_20_DOWN;
        if (i == 1) return -0.10e18;
        if (i == 2) return -0.05e18;
        if (i == 3) return -0.02e18;
        if (i == 4) return 0.02e18;
        if (i == 5) return 0.05e18;
        if (i == 6) return 0.10e18;
        return 0.20e18;
    }

    /// @dev lossStock_i = max(0, −sh_i) · stockLegUsd
    function lossStock(int256 sh, uint256 stockUsd) internal pure returns (uint256) {
        if (sh >= 0) return 0;
        return (uint256(-sh) * stockUsd) / WAD;
    }

    /// @dev β_i = 0.8·|sh| + 0.05·sh²  (WAD math: |sh|² then divide by WAD²)
    function beta(int256 sh) internal pure returns (uint256) {
        uint256 absSh = sh >= 0 ? uint256(sh) : uint256(-sh);
        uint256 linear = (LP_BETA * absSh) / WAD;
        uint256 convex = (LP_CONVEXITY * absSh) / WAD;
        convex = (convex * absSh) / WAD;
        return linear + convex;
    }

    /// @dev lossLP_i = lpLegUsd · β_i
    function lossLp(int256 sh, uint256 lpUsd) internal pure returns (uint256) {
        return (beta(sh) * lpUsd) / WAD;
    }

    /// @dev fee credit halves under negative shocks (§4.3)
    function feeCreditApplied(uint256 feeCreditBase, bool shockNegative)
        internal
        pure
        returns (uint256)
    {
        return shockNegative ? feeCreditBase / 2 : feeCreditBase;
    }

    /// @dev IM_i = max(0, lossStock + lossLP + lossR1·vol + lossR2 − feeCred)
    function scenarioIm(uint256 lossStockI, uint256 lossLpI, uint256 lossR1Scaled, uint256 lossR2, uint256 feeCred)
        internal
        pure
        returns (uint256)
    {
        uint256 gross = lossStockI + lossLpI + lossR1Scaled + lossR2;
        if (gross <= feeCred) return 0;
        return gross - feeCred;
    }

    /// @dev C_stressed = Σ haircutted collateral − IM_worst
    function stressedCollateral(Legs memory l, uint256 im) internal pure returns (uint256) {
        uint256 c = (l.stockUsd * HC_STOCK) / WAD + (l.lpUsd * HC_LP) / WAD;
        return c >= im ? c - im : 0;
    }

    /// @dev BP = floor(C_stressed · 0.80)
    function borrowingPower(uint256 cStressed) internal pure returns (uint256) {
        return (cStressed * LTV_MAX) / WAD;
    }

    /// @dev health = C_stressed / debt; dust guard 1e12 (§4.3)
    function health(uint256 cStressed, uint256 debtWad) internal pure returns (uint256) {
        uint256 d = debtWad < 1e12 ? 1e12 : debtWad;
        return (cStressed * WAD) / d;
    }
}
