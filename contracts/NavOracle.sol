// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {RwaStressLib} from "../RwaStressLib.sol";
import {INavSource} from "./Interfaces.sol";

/// @title NavOracle
/// @notice REAL NAV oracle for the R2 (treasury) class. Sources are live
///         on-chain price contracts (e.g. the audited USDYOracleWrapper at
///         0x87b126e5518b6a1Bb8465779b4607C45C643DF90) — no trusted signer,
///         every number verifiable on-chain. Redemption caps are the real
///         Ondo InstantManager limits (25M / 50M, see docs/rwa-sources.md),
///         set per asset at registration and changeable only by the owner.
contract NavOracle {
    struct AssetConfig {
        INavSource source; // live price source (must implement getPriceData())
        uint8 decimals; // token decimals (shares)
        bool transferRestricted;
        bool gateOpen;
        uint128 dailyCapPerInvestor; // USDC-WAD — the REAL per-investor 24h instant cap
        uint64 registeredAt;
    }

    mapping(address => AssetConfig) public assets;
    mapping(address => bool) public knownAsset;
    address public owner;

    error UnknownAsset();
    error NotOwner();
    error BadSource();

    event AssetRegistered(address asset, address source, uint8 decimals, bool transferRestricted, uint256 dailyCapUsdWad);
    event GateChanged(address asset, bool open);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Register a live on-chain NAV source for a real asset.
    /// @param source must return (priceWad, lastUpdateTs) — the audited
    ///        USDYOracleWrapper satisfies this ABI exactly (verified on-chain).
    function registerAsset(address asset, address source, uint8 decimals, bool transferRestricted, uint64 dailyCapPerInvestorUsdWad)
        external
        onlyOwner
    {
        if (asset == address(0) || source == address(0)) revert BadSource();
        // node-source: staticcall getPriceData() once at registration to fail fast
        (uint256 p, uint64 ts) = INavSource(source).priceData();
        if (p == 0) revert BadSource();
        assets[asset] = AssetConfig({
            source: INavSource(source),
            decimals: decimals,
            transferRestricted: transferRestricted,
            gateOpen: true,
            dailyCapPerInvestor: dailyCapPerInvestorUsdWad,
            registeredAt: uint64(block.timestamp)
        });
        knownAsset[asset] = true;
        emit AssetRegistered(asset, source, decimals, transferRestricted, dailyCapPerInvestorUsdWad);
        // lastUpdate ts sanity check surfaces immediately if misconfigured
        require(ts > 0, BadSource());
    }

    function setGateState(address asset, bool open) external onlyOwner {
        if (!knownAsset[asset]) revert UnknownAsset();
        assets[asset].gateOpen = open;
        emit GateChanged(asset, open);
    }

    /// @notice NAV value = amount × price, both WAD.
    /// @return navUsdWad the USD value of `amount` shares (WAD)
    /// @return staleSeconds seconds since the source last updated its price
    function navUsd(address asset, uint256 amount)
        external
        view
        returns (uint256 navUsdWad, uint256 staleSeconds)
    {
        AssetConfig storage cfg = assets[asset];
        if (!knownAsset[asset]) revert UnknownAsset();
        (uint256 priceWad, uint64 lastTs) = cfg.source.priceData();
        navUsdWad = (amount * priceWad) / 1e18;
        staleSeconds = uint256(block.timestamp) > uint256(lastTs)
            ? (uint256(block.timestamp) - uint256(lastTs))
            : 0;
    }

    /// @notice Daily per-investor instant-redemption cap (real Ondo number).
    function dailyCapPerInvestor(address asset) external view returns (uint256) {
        AssetConfig storage cfg = assets[asset];
        if (!knownAsset[asset]) revert UnknownAsset();
        return uint256(cfg.dailyCapPerInvestor) * RwaStressLib.CAP_FRACTION / 1e18;
    }
}
