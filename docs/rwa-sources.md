# RWA sources — verified (production)

Every external number/address the engine depends on, with its source and
verification date. Nothing here is invented; each entry was checked against a
primary source and, where noted, re-verified on-chain via a live RPC read
(`cast call`).

## USDY — treasury NAV class (R2 leg)

| Fact | Value | Source | Verified |
|---|---|---|---|
| USDY token (Ethereum) | `0x96F6eF951840721AdBF46Ac996b59E0235CB985C` | Ondo docs — Smart Contract Addresses (`docs.ondo.finance/addresses.md`) | 2026-11-06 |
| USDYOracleWrapper (stable read entry) | `0x87b126e5518b6a1Bb8465779b4607C45C643DF90` | Ondo docs — addresses | 2026-11-06 |
| Price model | Continuous: stored price grown at a stored yearly rate; `getPrice()` recomputes on every read | Ondo docs — USDY Price Oracle (`general-access-products/usdy/usdy-price-oracle.md`) | 2026-11-06 |
| **Live mainnet read** | `getPrice()` → `1152178628849877179` (≈ $1.15217862 / USDY, growing continuously) | `cast call` via public RPC (`ethereum-rpc.publicnode.com`) | 2026-11-06 |
| `getPriceData()` | returns `(price WAD, lastUpdate ts)` — 2 words verified on-chain | `cast call` | 2026-11-06 |
| Rate-change controls | ≤10% relative change / ≥8h apart without timelock; Spearbit + Cyfrin audited | Ondo docs — USDY Price Oracle | 2026-11-06 |
| `getPriceHistorical` | NOT supported (by wrapper or new oracle) — the engine therefore derives accrual from two live price reads at accrual boundaries | Ondo docs — USDY Price Oracle | 2026-11-06 |

**Accrual design implication (real, not modelled):** because the canonical USDY
price grows continuously on-chain, the engine computes the R2 coupon as
`amount × (price(now) − price(lastAccrualTs))` — two real `getPrice()` reads of
the audited wrapper, zero trusted signers, exact to the ask. This replaces the
paper `accrualPerSecondWad` fixture with the same quantity computed from the
real price function.

## OUSG — qualified-access treasuries (R2-class gate math source)

| Fact | Value | Source | Verified |
|---|---|---|---|
| OUSG token (Ethereum) | `0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92` | Ondo docs — addresses | 2026-11-06 |
| OUSG_InstantManager | `0x93358db73B6cd4b98D89c8F5f230E81a95c2643a` | Ondo docs — addresses | 2026-11-06 |
| Instant redemption limits | **$25,000,000 per investor / 24h; $50,000,000 global / 24h**; $5,000 min per tx | Ondo docs — Instant Minting and Redemption Limits (`qualified-access-products/ousg/instant-limits.md`) | 2026-11-06 |
| Price source | `OndoOracle` unified price oracle `0x9Cad45a8BF0Ed41Ff33074449B357C7a1fAb4094` | Ondo docs — addresses | 2026-11-06 |

These caps are the engine's R2 unwind-eligibility constants (`DAILY_CAP_PER_INVESTOR = 25M`,
`ALL_INVESTORS_CAP = 50M`, spec §4.2). They are settable per-asset in the adapter
(owner-gated) rather than hard-coded into the engine, exact values pinned above.

## Tokenized equity — R1 leg (real Ondo Stocks GM tokens)

| Fact | Value | Source | Verified |
|---|---|---|---|
| Token registry | 452 tokenized stocks + ETFs across Ethereum, BSC, Solana, HyperEVM, Robinhood Chain | Ondo partner token registry (`docs.ondo.finance/partner-docs/tokens.md` + official CSV) | 2026-11-06 |
| **No Base deployment** | Ondo Stocks are NOT deployed to Base; the engine therefore deploys to Ethereum mainnet where the collateral actually lives | Same registry | 2026-11-06 |
| Example real asset — COINon (Coinbase, tokenized) | Ethereum `0xF042cfa86cf1D598a75Bdb55c3507a1F39f9493b` | Official CSV | 2026-11-06 |
| Example real asset — USDon (settlement token) | Ethereum `0xAcE8E719899F6E91831B18AE746C9A965c2119F1` | Official CSV | 2026-11-06 |
| Transferability | Tokenized stocks are transferable (jurisdiction gates apply; blocklisted wallets excluded) | Ondo docs — Transferability | 2026-11-06 |
| Marks | Ondo's GM price API (`api.gm.ondo.finance/v1/assets/{symbol}/prices/latest`, `x-api-key`) is documented as **display only** and Ondo states an official oracle is in development; the engine therefore treats GM-API marks as an advisory feed with a disclosed trusted-mark model, never as the unwinder's price source of truth | Ondo API reference | 2026-11-06 |
| Dividends | Tokenized-stock dividend treatment is withheld from the coupon engine: **R1 coupon = 0** until a verified corporate-actions feed exists | Ondo API — dividend endpoint is informational | 2026-11-06 |

## Chain decision

`CreditEngine` deploys to **Ethereum mainnet** (real collateral tokens + real
NAV oracles exist there). The original spec's Base/1inch-Aqua leg was a
sponsor-gate assumption (§0.7); with the prizes not part of a production
launch, the Aqua virtual-balance line is replaced by an engine-escrowed
USDC line on the collateral's own chain, disclosed in `docs/limits.md`.

## Re-verification commands (run before each production deploy)

```bash
cast call 0x87b126e5518b6a1Bb8465779b4607C45C643DF90 "getPrice()(uint256)" --rpc-url $RPC_ETH_MAINNET
cast call 0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92 "decimals()(uint8)" --rpc-url $RPC_ETH_MAINNET
cast call 0xF042cfa86cf1D598a75Bdb55c3507a1F39f9493b "decimals()(uint8)" --rpc-url $RPC_ETH_MAINNET
```

A changed address or failing read blocks the deploy (see `docs/limits.md`).
