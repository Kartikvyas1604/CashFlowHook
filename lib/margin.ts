/**
 * TS mirror of agent/Agent.md §4.3 — canonical margin math.
 *
 * This file is the display mirror for the credit desk. The canonical
 * fixed-point (WAD 1e18) implementation lives in the Solidity contracts
 * (SpanMathLib.sol + RwaStressLib.sol per §6.1/§6.2); §4.6 rounding for
 * the mirrored engine is floor for collateral/health/accrual, ceil for
 * debt. Every constant below is quoted from §4.2/§6.1/§6.2 — no new
 * assumptions are introduced here.
 *
 * Scenario index s = i·2 + j, i ∈ [0..7] shock, j ∈ [0..1] vol.
 */

export const SHOCKS = [
  -0.20, -0.10, -0.05, -0.02, 0.02, 0.05, 0.10, 0.20,
] as const; // 8 shocks, WAD fractions (§4.2)

export const VOL_STATES = [1.0, 1.5] as const; // 2 vol multipliers → 16 scenarios

export const HC_STOCK = 0.85; // §4.2 haircut, stock leg
export const HC_LP = 0.70; // haircut, LP leg
export const HC_R1 = 0.75; // haircut, RWA equity [assumption per Agent.md]
export const HC_R2 = 0.85; // haircut, RWA treasury [assumption per Agent.md]
export const LTV_MAX = 0.80; // draw cap vs stressed collateral
export const MAINT = 0.85; // health threshold → unwind eligible
export const LP_BETA = 0.8; // LP linear beta
export const LP_CONVEX = 0.05; // LP convexity (fraction²)
export const GAP_PREMIUM = 0.5; // R1 weekend/overnight gap multiplier [assumption]
export const PERM_LIQ_HC = 0.015; // R2 permissioned-liquidity haircut (1.5% of NAV) [assumption]
export const R2_EXIT_COST_FRAC = 0.005; // exit-cost term, capped [assumption]
export const GATE_DAYS = 2; // [assumption — conservative]
export const DAILY_CAP_PER_INVESTOR = 25_000_000; // OUSG instant redeem, USD (verified per §4.2)
export const ALL_INVESTORS_CAP = 50_000_000; // USD per 24h, all investors (verified per §4.2)
export const CAP_FRACTION = 0.25; // of daily per-investor cap → R2 unwind-eligibility threshold
export const FEE_CREDIT_CAP_FRAC = 0.10; // combined fee + accrual credit cap vs total collateral
export const TAKER_FLOOR = 5; // below → fee credit 0 (I6)
export const TAKER_SYBIL_DENOM = 20; // min(1, takers/20)
export const EARNINGS_WINDOW_DAYS = 7;
export const AUTONOMY_CAP_PCT = 0.02; // 2% of BP per draw
export const AUTONOMY_DRAW_WINDOW = 12; // hours
export const AUTONOMY_MAX_DRAWS = 3; // per 12h — 4th reverts CapExceededBlock (F8)
export const MARK_STALENESS = 1_800; // s — ST/LP marks older → STALE_MARK (I9)
export const NAV_STALENESS = 93_600; // s — 26h: daily NAV + slack; stale → R2 eligibility 0 (I9)
export const COUPON_PERIOD = 86_400; // s — daily accrual
export const ACCRUAL_HOLD_CAP = 604_800; // s — 7d per-record accrual credit ceiling (§4.2)
export const MIN_HOLD_FOR_CREDIT = COUPON_PERIOD; // I12

export interface EarningsInputs {
  /** trailing 7d average daily LP fees, USD */
  avg7dFees: number;
  /** distinct takers in the record (borrower excluded onchain, F6) */
  takers: number;
  /** normalized earnings volatility σ/μ */
  sigmaOverMu: number;
  /** max weekly drawdown fraction */
  maxWeeklyDDfrac: number;
}

export interface LegUsd {
  /** stock leg marked value, USD */
  stockUsd: number;
  /** LP strategy leg marked value, USD */
  lpUsd: number;
  /** RWA equity leg (R1) marked value, USD */
  equityRwaUsd: number;
  /** RWA treasury leg (R2) NAV value, USD */
  navUsd: number;
}

export interface SegregationInputs {
  r1TransferRestricted: boolean;
  r2GateOpen: boolean;
  /** NAV record staleness seconds (I9: > 26h → R2 eligibility 0) */
  navStalenessSeconds: number;
}

export interface CreditInputs extends LegUsd {
  debt: number;
  /** R2 daily coupon = accrualPerSecondWad · navAmt · 86400, USD */
  dailyCoupon: number;
  /** seconds since lastAccrualTs (monotonic, I12) */
  heldSeconds: number;
  earnings: EarningsInputs;
  segregation: SegregationInputs;
}

export interface ScenarioResult {
  /** scenario index s = i·2 + j */
  s: number;
  /** grid shock index i */
  i: number;
  /** vol state index j */
  j: number;
  /** sh = S[i]·V[j] — the scaled shock */
  sh: number;
  vol: number;
  lossStock: number;
  lossLP: number;
  /** lossR1 = equityRwaUsd · max(0, −sh±0.20) · (1 + GAP_PREMIUM); scaled by vol in IM */
  lossR1: number;
  lossR2: number;
  /** fee credit applied at this scenario: feeCreditBase · (sh < 0 ? 0.5 : 1.0) */
  feeCreditApplied: number;
  /** IM_i = max(0, lossStock + lossLP + lossR1·vol + lossR2 − feeCreditApplied) */
  lossIM: number;
}

/* ------------------------------------------------------------------ */
/* scenario math (§4.3 canonical)                                      */
/* ------------------------------------------------------------------ */

export function lossStock(sh: number, stockUsd: number): number {
  return Math.max(0, -sh) * stockUsd;
}

export function beta(sh: number): number {
  return LP_BETA * Math.abs(sh) + LP_CONVEX * sh * sh;
}

export function lossLP(sh: number, lpUsd: number): number {
  return lpUsd * beta(sh);
}

/** worst gated-shock loss for R1: max(0, −sh_20) = 0.20, premium 1.5× */
export function lossR1(equityRwaUsd: number): number {
  return equityRwaUsd * 0.20 * (1 + GAP_PREMIUM);
}

export function lossR2(navUsd: number, dailyCoupon: number): number {
  const exitCost = Math.min(navUsd * R2_EXIT_COST_FRAC, dailyCoupon * GATE_DAYS);
  return navUsd * PERM_LIQ_HC + exitCost;
}

/* fee credit (§4.3, I6, F20)                                          */

export function feeCreditFees(e: EarningsInputs): number {
  if (e.takers < TAKER_FLOOR) return 0; // I6
  const sybil = Math.min(1, e.takers / TAKER_SYBIL_DENOM);
  const vol = 1 - 0.5 * e.sigmaOverMu;
  const dd = 1 - 0.3 * e.maxWeeklyDDfrac;
  return 3 * e.avg7dFees * sybil * vol * dd;
}

export function navAccrualCredit(dailyCoupon: number, heldSeconds: number): number {
  if (heldSeconds < MIN_HOLD_FOR_CREDIT) return 0; // I12
  const perSecond = dailyCoupon / COUPON_PERIOD; // dailyCoupon = perSecond · 86400
  return perSecond * Math.min(heldSeconds, ACCRUAL_HOLD_CAP);
}

export function feeCreditBase(
  e: EarningsInputs,
  dailyCoupon: number,
  heldSeconds: number,
  totalCollateralUsd: number
): number {
  const combined = feeCreditFees(e) + navAccrualCredit(dailyCoupon, heldSeconds);
  return Math.min(combined, FEE_CREDIT_CAP_FRAC * totalCollateralUsd); // combined 10% cap (F20)
}

/* ------------------------------------------------------------------ */
/* 16-scenario grid                                                    */
/* ------------------------------------------------------------------ */

export function scenarioLosses(
  legs: LegUsd,
  feeCreditBaseValue: number,
  r2: number // lossR2 leg term, computed once per account (independent of vol)
): ScenarioResult[] {
  const r1 = lossR1(legs.equityRwaUsd);
  const out: ScenarioResult[] = [];
  for (let i = 0; i < SHOCKS.length; i++) {
    for (let j = 0; j < VOL_STATES.length; j++) {
      const sh = SHOCKS[i] * VOL_STATES[j];
      const fc = feeCreditBaseValue * (SHOCKS[i] < 0 ? 0.5 : 1.0);
      const lossStockI = lossStock(sh, legs.stockUsd);
      const lossLPI = lossLP(sh, legs.lpUsd);
      out.push({
        s: i * 2 + j,
        i,
        j,
        sh,
        vol: VOL_STATES[j],
        lossStock: lossStockI,
        lossLP: lossLPI,
        lossR1: r1,
        lossR2: r2,
        feeCreditApplied: fc,
        lossIM: Math.max(
          0,
          lossStockI + lossLPI + r1 * VOL_STATES[j] + r2 - fc
        ),
      });
    }
  }
  return out;
}

/**
 * Canonical entry point — computes everything the desk displays.
 * All values are raw precision USD; display formatting is `lib/format.ts`.
 */
export function marginBreakdown(input: CreditInputs) {
  const totalCollateralUsd =
    input.stockUsd + input.lpUsd + input.equityRwaUsd + input.navUsd;

  const fcb = feeCreditBase(
    input.earnings,
    input.dailyCoupon,
    input.heldSeconds,
    totalCollateralUsd
  );

  const scenarios = scenarioLosses(input, fcb, lossR2(input.navUsd, input.dailyCoupon));

  // IM = max over the 16 scenarios (§4.3)
  const worst = scenarios.reduce((a, b) => (b.lossIM > a.lossIM ? b : a));
  const im = worst.lossIM;

  const cStressed =
    input.stockUsd * HC_STOCK +
    input.lpUsd * HC_LP +
    input.equityRwaUsd * HC_R1 +
    input.navUsd * HC_R2 -
    im;

  const bp = Math.floor(cStressed * LTV_MAX); // BP = floor(C_stressed · 0.80) (§4.6 floor)
  const health = cStressed / Math.max(input.debt, 1e-6); // §4.3 (1e12 WAD dust guard)

  // Segregated margin (v3 core, §4.3; eligibility flags per RwaStressLib §6.2)
  const eligR1 = input.segregation.r1TransferRestricted ? 0 : 1; // I11
  const navStale = input.segregation.navStalenessSeconds > NAV_STALENESS;
  const eligR2 =
    input.segregation.r2GateOpen && !navStale &&
    input.navUsd <= DAILY_CAP_PER_INVESTOR * CAP_FRACTION
      ? 1
      : 0;

  const unwindableNow =
    input.stockUsd * HC_STOCK +
    input.lpUsd * HC_LP +
    input.equityRwaUsd * HC_R1 * eligR1 +
    input.navUsd * HC_R2 * eligR2;

  const haircutAll =
    input.stockUsd * HC_STOCK +
    input.lpUsd * HC_LP +
    input.equityRwaUsd * HC_R1 +
    input.navUsd * HC_R2;
  const earningLocked = haircutAll - unwindableNow;

  const stressed =
    health < MAINT || input.debt > unwindableNow * LTV_MAX; // §4.4 STRESSED

  return {
    totalCollateralUsd,
    feeCreditBase: fcb,
    feeCreditFeesValue: feeCreditFees(input.earnings),
    navAccrualCreditValue: navAccrualCredit(input.dailyCoupon, input.heldSeconds),
    feeCreditCap: FEE_CREDIT_CAP_FRAC * totalCollateralUsd,
    scenarios,
    worstScenario: worst,
    im,
    cStressed,
    bp,
    health,
    eligR1,
    eligR2,
    unwindableNow,
    earningLocked,
    stressed,
    // autonomy (§4.2 defaults)
    perDrawCap: Math.floor(bp * AUTONOMY_CAP_PCT),
    drawsPerWindow: AUTONOMY_MAX_DRAWS,
    windowHours: AUTONOMY_WINDOW_H,
  } as const;
}

/* ------------------------------------------------------------------ */
/* StrategyScore (§4.3, computed+stored by StrategyBureau §6.6)         */
/* ------------------------------------------------------------------ */

export function strategyScore(e: {
  takers: number;
  sigmaOverMu: number;
  maxWeeklyDDfrac: number;
  ageDays: number;
}): number | null {
  if (e.takers < TAKER_FLOOR) return null; // gated by takers ≥ 5
  const sigmaTerm = 0.5 * (1 - Math.min(1, e.sigmaOverMu));
  const ddTerm = 0.3 * (1 - e.maxWeeklyDDfrac);
  const ageTerm = 0.2 * Math.min(1, e.ageDays / 7);
  return Math.min(100, Math.round(100 * (sigmaTerm + ddTerm + ageTerm)));
}

/* ------------------------------------------------------------------ */
/* state machine helpers (§4.4)                                        */
/* ------------------------------------------------------------------ */

export function unwindEligible(health: number): boolean {
  return health < MAINT;
}

export function drawAllowed(params: {
  debt: number;
  amount: number;
  bp: number;
  perDrawCap: number;
  drawsInWindow: number;
}): { ok: boolean; reason?: string } {
  if (params.drawsInWindow >= AUTONOMY_MAX_DRAWS)
    return { ok: false, reason: "CapExceededBlock — 4th draw in the 12 h window" };
  if (params.amount > params.perDrawCap)
    return {
      ok: false,
      reason: `Draw exceeds the per-draw autonomy cap of $${Math.floor(
        params.perDrawCap
      ).toLocaleString("en-US")}`,
    };
  if (params.debt + params.amount > params.bp)
    return {
      ok: false,
      reason: "DebtExceedsBp — debt would exceed borrowing power (I2)",
    };
  return { ok: true };
}
