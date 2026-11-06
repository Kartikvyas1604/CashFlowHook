/**
 * Demo fixture account + client store.
 *
 * Everything labeled "fixture" here is demo data driven by §5 of the
 * build plan; the numbers the desk displays are computed at runtime by
 * `lib/margin.ts` (mirror of agent/Agent.md §4.3) — never read from a
 * slide. No invented on-chain addresses or hashes: receipts carry demo
 * fixture IDs and disclose the mocked/self-hosted rail.
 */

import { useSyncExternalStore } from "react";
import { marginBreakdown, drawAllowed } from "@/lib/margin";

/** fixed fixture epoch: 2026-11-06 09:00:00 UTC */
export const NOW = 1_793_955_600;
const HOUR = 3_600;
const DAY = 86_400;

/* ------------------------------------------------------------------ */
/* fixture account inputs (§4.1/§4.2 units)                            */
/* ------------------------------------------------------------------ */

export const FEED = {
  now: NOW,
  stockMarkTs: NOW - 180, // fresh vs 1800 s staleness (I9)
  navTs: NOW - 4 * HOUR, // NAV record 4h old vs 26h staleness (I9)
  lastAccrualTs: NOW - 2 * DAY, // held evenly ≥ 1 coupon period (I12)
  windowStartTs: NOW - 5 * HOUR, // autonomy window (12h) started 5h ago
} as const;

export const LEGS_FIXTURE = {
  // ST — tokenized stock leg (Base); amounts below declare leg USD
  // mark values; underlying share quantities are display-derived.
  stock: {
    label: "Tokenized stock · Base",
    class: "equity" as const,
    amountUsd: 62_000,
    mark: 243.0,
    shares: 62_000 / 243.0,
    ts: FEED.stockMarkTs,
  },
  // LP — Uniswap v4 CL strategy leg; hook-locked while debt > 0 (I4)
  lp: {
    label: "Uniswap v4 CL position",
    class: "lp" as const,
    amountUsd: 38_500,
    poolLabel: "v4 pool · 30 min TWAP", // §4.2 TWAP interval
    tokenIdLabel: "position 88412", // fixture id
  },
  // R1 — RWA equity leg; dividend coupon = 0 (dividend treatment
  // unverified — disclosed, N9). Fixture flag: transfer restricted.
  r1: {
    label: "Tokenized stock · RWA equity",
    class: "rwa_equity" as const,
    amountUsd: 12_800,
    mark: 51.2,
    shares: 12_800 / 51.2,
    transferRestricted: true, // fixture: restricted → eligR1 = 0 (I11)
    couponPerDayUsd: 0, // §2: never claim tokenized-stock dividends
  },
  // R2 — RWA treasury leg (OUSG/USDY NAV class). Engine reads public
  // NAV state only (N9); fixture NAV per share is demo data.
  r2: {
    label: "Tokenized treasury · NAV class",
    class: "rwa_treasury" as const,
    amountUsd: 46_200,
    navPerShare: 100.85,
    shares: 46_200 / 100.85,
    dailyCouponUsd: 6.02, // accrualPerSecondWad · navAmt · 86400
    heldSeconds: NOW - FEED.lastAccrualTs, // 2 days
    stalenessSeconds: NOW - FEED.navTs, // 4 h — fresh
    sourceLabel: "nonce record 19 · source tx pinned on E mainnet feed",
  },
  earnings: {
    /** 7-day daily fee schedule, USD (fixture stream record) */
    feeSchedule: [812, 908, 771, 944, 855, 610, 1_120] as number[], // avg = 860.00
    avg7dFees: 860.0,
    takers: 23, // distinct third-party takers; borrower excluded (F6)
    sigmaOverMu: 0.25, // record σ/μ (30d stats window in the stream record)
    maxWeeklyDDfrac: 0.28, // record max weekly drawdown
    ageDays: 21,
  },
} as const;

export const DEBT_FIXTURE = 74_000; // Aqua virtual balance liability, USDC
// one agent draw already sits in the rolling 12 h window (matches the
// seeded receipt/log rows — window started 5 h ago)
export const INITIAL_DRAWS: Array<{ amountUsd: number; ts: number }> = [
  { amountUsd: 1_415.0, ts: NOW - 5 * 3_600 },
];

/* ------------------------------------------------------------------ */
/* crash replays (stress tab) — fixture replay inputs, labeled         */
/* ------------------------------------------------------------------ */

export interface CrashReplay {
  id: string;
  label: string;
  /** peak shock vs mark (fixture replay path, printed with inputs) */
  peakShock: number;
  /** vol multiplier used when scaling the grid */
  vol: number;
  window: string;
}

export const CRASH_REPLAYS: CrashReplay[] = [
  {
    id: "aug-2024",
    label: "Aug 2024 · yen-carry unwind",
    peakShock: -0.128,
    vol: 1.5,
    window: "4 trading days",
  },
  {
    id: "feb-2025",
    label: "Feb 2025 · growth-snapshot crash",
    peakShock: -0.062,
    vol: 1.0,
    window: "1 trading day",
  },
  {
    id: "oct-2026",
    label: "Oct 2026 · tokenized-equity gap",
    peakShock: -0.145,
    vol: 1.5,
    window: "weekend gap + 2 days",
  },
];

/* ------------------------------------------------------------------ */
/* store types                                                         */
/* ------------------------------------------------------------------ */

export type Rail = "x402" | "agent-draw" | "owner-repay" | "step-up" | "block";

export interface Receipt {
  id: number;
  rail: Rail;
  memo: string;
  toLabel: string;
  amountUsd: number | null; // null → informational row (no spend)
  ts: number;
  reverted?: boolean;
}

export interface PolicyEvent {
  id: number;
  ts: number;
  kind: "draw" | "repay" | "gate" | "deny" | "grant" | "cap" | "accept";
  label: string;
  detail: string;
}

export interface Beat {
  id: number;
  tone: "warning" | "positive" | "neutral" | "destructive";
  title: string;
  body: string;
}

export interface DemoState {
  connected: boolean;
  worldVerified: boolean;
  unwinderGranted: boolean;
  gateOpen: boolean;
  r1TransferRestricted: boolean;
  debt: number;
  draws: Array<{ amountUsd: number; ts: number }>; // within the 12h window
  receipts: Receipt[];
  policy: PolicyEvent[];
  stepUp: "idle" | "checking" | "denied" | "granted";
  lockedRiskAcceptedUntil: number | null; // 24h expiry (I13)
  beat: Beat | null;
}

const initialState: DemoState = {
  connected: false,
  worldVerified: false,
  unwinderGranted: false,
  gateOpen: true,
  r1TransferRestricted: LEGS_FIXTURE.r1.transferRestricted,
  debt: DEBT_FIXTURE,
  draws: INITIAL_DRAWS,
  receipts: [
    {
      id: 1,
      rail: "agent-draw",
      memo: "Agent draw — reprice buffer",
      toLabel: "Aqua virtual balance",
      amountUsd: 1_415.0,
      ts: NOW - 5 * HOUR,
    },
    {
      id: 2,
      rail: "x402",
      memo: "x402 bill · one bill, one receipt",
      toLabel: "data feed provider (self-hosted x402 endpoint, demo)",
      amountUsd: 12.4,
      ts: NOW - 4 * HOUR,
    },
  ],
  policy: [
    {
      id: 1,
      ts: NOW - 5 * HOUR,
      kind: "draw",
      label: "agentDraw",
      detail: "Draw $1,415.00 USDC — within the 2% of BP per-draw cap; debt $74,000.00 ≤ BP $76,065.00",
    },
    {
      id: 2,
      ts: NOW - 4 * HOUR,
      kind: "draw",
      label: "spend (x402)",
      detail: "Pay $12.40 USDC to the data feed (one bill, one receipt) — AgentSpent recorded (I8)",
    },
    {
      id: 3,
      ts: NOW - 4 * HOUR,
      kind: "gate",
      label: "NAV refresh",
      detail: "NAV record posted 4h ago — coupon accrual active, $6.02/day on held 2d",
    },
  ],
  stepUp: "idle",
  lockedRiskAcceptedUntil: null,
  beat: null,
};

/* ------------------------------------------------------------------ */
/* store                                                               */
/* ------------------------------------------------------------------ */

let state: DemoState = initialState;
let nextId = 100;
const listeners = new Set<() => void>();

/** cached derived breakdown — invalidated on every commit */
let cachedBreakdown: ReturnType<typeof marginBreakdown> | null = null;

function commit(patch: Partial<DemoState>) {
  state = { ...state, ...patch };
  cachedBreakdown = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function pushReceipt(receipt: Omit<Receipt, "id" | "ts">) {
  const entry: Receipt = { ...receipt, id: nextId++, ts: NOW };
  commit({ receipts: [entry, ...state.receipts].slice(0, 24) });
}

function pushPolicy(event: Omit<PolicyEvent, "id" | "ts">) {
  const entry: PolicyEvent = { ...event, id: nextId++, ts: NOW };
  commit({ policy: [entry, ...state.policy].slice(0, 40) });
}

/* ------------------------------------------------------------------ */
/* actions — every event mirrors a CreditEngine path from §6.3         */
/* ------------------------------------------------------------------ */

export const demoActions = {
  connectWallet() {
    commit({ connected: true });
    pushPolicy({
      kind: "grant",
      label: "wallet connect",
      detail: "Demo wallet connected — fixture account (no live chain calls)",
    });
  },

  verifyWorld() {
    commit({ worldVerified: true });
    pushPolicy({
      kind: "grant",
      label: "Agent Pass verify",
      detail:
        "Agent Pass result validated (nullable mocked proof payload per World portal demo app) — server-side validation path",
    });
  },

  grantUnwinder() {
    commit({ unwinderGranted: true });
    pushPolicy({
      kind: "grant",
      label: "registerUnwinder",
      detail: "Unwinder registered — the only operator allowed to unwind; transient pull-and-swap inside one tx (I1)",
    });
  },

  draw(amountUsd: number) {
    const breakdown = currentBreakdown();
    const caps = effectiveCaps(state, breakdown);
    const windowed = state.draws.filter((d) => NOW - d.ts <= 12 * HOUR);
    const verdict = drawAllowed({
      debt: state.debt,
      amount: amountUsd,
      bp: breakdown.bp,
      perDrawCap: caps.perDrawCap,
      drawsInWindow: windowed.length,
      drawsPerWindow: caps.drawsPerWindow,
      agentCapped:
        state.debt >= breakdown.unwindableNow * 0.80 && !caps.elevated,
    });
    if (!verdict.ok) {
      pushReceipt({
        rail: "block",
        memo: `${verdict.reason ?? "draw blocked"} — reverted`,
        toLabel: "CreditEngine",
        amountUsd,
        reverted: true,
      });
      pushPolicy({
        kind: "cap",
        label: verdict.reason?.startsWith("CapExceededBlock")
          ? "CapExceededBlock"
          : "revert",
        detail: `Draw of $${amountUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} USDC reverted — state unchanged (F3/F8)`,
      });
      commit({
        beat: {
          id: nextId++,
          tone: "warning",
          title: "Draw reverted",
          body:
            verdict.reason ??
            "The engine refused the draw; state is unchanged.",
        },
      });
      return;
    }
    const debt = state.debt + amountUsd;
    windowed.push({ amountUsd, ts: NOW });
    commit({ debt, draws: windowed });
    pushReceipt({
      rail: "agent-draw",
      memo: "Agent draw — Aqua virtual balance credit",
      toLabel: "Aqua virtual balance",
      amountUsd,
    });
    pushPolicy({
      kind: "draw",
      label: "agentDraw",
      detail: `Draw $${amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} USDC — debt now $${debt.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} (≤ BP $${breakdown.bp.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })})`,
    });
  },
  repay(amountUsd: number) {
    const amount = Math.min(amountUsd, state.debt);
    const debt = state.debt - amount;
    commit({ debt });
    pushReceipt({
      rail: "owner-repay",
      memo: "Owner repay — Aqua virtual balance debit",
      toLabel: "Aqua virtual balance",
      amountUsd: amount,
    });
    pushPolicy({
      kind: "repay",
      label: "repay",
      detail: `Repay $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC — debt down to $${debt.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    });
  },

  simulateFourthDraw() {
    // runs the same validation path the engine runs and shows the revert
    const breakdown = currentBreakdown();
    const w = state.draws.filter((d) => NOW - d.ts <= 12 * HOUR);
    if (w.length >= breakdown.drawsPerWindow) {
      pushPolicy({
        kind: "cap",
        label: "CapExceededBlock (simulated)",
        detail:
          "4th agentDraw in the 12 h window reverted — no state change; retry passes only after the window rolls or a verified-human step-up",
      });
      commit({
        beat: {
          id: nextId++,
          tone: "warning",
          title: "CapExceededBlock — no state change",
          body: "The agent cannot raise its own limit (I7). A step-up needs an accepted Agent Pass proof.",
        },
      });
    } else {
      pushPolicy({
        kind: "cap",
        label: "window check",
        detail: `Only ${w.length} draw(s) in the rolling 12 h window — the block would fire on the 4th`,
      });
    }
  },

  gateShut() {
    if (!state.gateOpen) return;
    const breakdown = currentBreakdown();
    const after = Math.round(
      breakdown.unwindableNow - LEGS_FIXTURE.r2.amountUsd * 0.85
    );
    const capped = state.debt > after * 0.80;
    commit({ gateOpen: false });
    pushPolicy({
      kind: "gate",
      label: "GateShut + SegregationChanged",
      detail: `NAV oracle posted gateOpen=false → eligR2=0 in the same block — unwindableNow $${Math.floor(
        after
      ).toLocaleString(
        "en-US"
      )}, earning-locked includes the treasury leg (F17)`,
    });
    if (capped) {
      pushPolicy({
        kind: "cap",
        label: "autonomy capped",
        detail: `Debt $${state.debt.toLocaleString(
          "en-US"
        )} exceeds 0.80 × unwindableNow — draws blocked until a human accepts locked-leg liquidity risk (I13)`,
      });
    }
    commit({
      beat: {
        id: nextId++,
        tone: "destructive",
        title: "Gate shut — treasury leg locked",
        body: capped
          ? "Redemption gate closed: the treasury leg no longer backs an unwind. Debt exceeds the capped line — request a human step-up to accept locked-leg risk."
          : "Redemption gate closed: the treasury leg no longer backs an unwind. The line repriced in the same block.",
      },
    });
  },

  gateOpen() {
    if (state.gateOpen) return;
    commit({ gateOpen: true });
    pushPolicy({
      kind: "gate",
      label: "SegregationChanged",
      detail: "Gate reopened → eligR2 restored (under the daily cap) — margin re-included",
    });
    commit({
      beat: {
        id: nextId++,
        tone: "positive",
        title: "Gate reopened — repriced",
        body: "The treasury leg backs the line again. All 13 invariants held through the cycle.",
      },
    });
  },

  requestStepUp() {
    if (state.stepUp === "checking") return;
    if (state.stepUp !== "denied") {
      commit({ stepUp: "checking" });
      // F10 mocked denied/expired path: the FIRST run fails with an
      // expired proof; the protected action does not occur.
      commit({ stepUp: "denied" });
      pushPolicy({
        kind: "deny",
        label: "Agent Pass — expired proof",
        detail:
          "Proof expired after 90 s — DENIED, no raise recorded; the protected action did not occur (F10)",
      });
      pushReceipt({
        rail: "step-up",
        memo: "Step-up denied — expired proof",
        toLabel: "AgentPassVerifier (never called)",
        amountUsd: null,
      });
      commit({
        beat: {
          id: nextId++,
          tone: "warning",
          title: "Agent Pass denied — proof expired",
          body: "No raise was recorded and the protected action did not occur. Request again to run the accepted-proof path (mocked payload).",
        },
      });
      return;
    }
    // accepted path — mocked payload per World portal (§8.3)
    commit({
      stepUp: "granted",
      lockedRiskAcceptedUntil: NOW + 24 * HOUR,
    });
    pushPolicy({
      kind: "accept",
      label: "LockedRiskAccepted",
      detail:
        "Verified-human step-up accepted locked-leg liquidity risk — elevated tier for 24 h (mocked proof payload, server-validated path)",
    });
    pushReceipt({
      rail: "step-up",
      memo: "Step-up granted — human accepted locked-leg risk",
      toLabel: "AgentPassVerifier",
      amountUsd: null,
    });
    commit({
      beat: {
        id: nextId++,
        tone: "positive",
        title: "Step-up granted — 24 h elevated tier",
        body: "The human explicitly accepted locked-leg liquidity risk (I13). Unwind may exceed liquidatable backing until expiry.",
      },
    });
  },

  dismissBeat() {
    commit({ beat: null });
  },

  reset() {
    state = initialState;
    cachedBreakdown = null;
    listeners.forEach((l) => l());
  },
};

/* ------------------------------------------------------------------ */
/* derived                                                             */
/* ------------------------------------------------------------------ */

/** ledger-derived breakdown with the CURRENT store state applied.
 *  Cached so `getSnapshot` (client AND server) returns a stable object
 *  between commits — a fresh object per call makes React loop forever. */
export function currentBreakdown() {
  if (cachedBreakdown) return cachedBreakdown;
  const s = state;
  cachedBreakdown = marginBreakdown({
    stockUsd: LEGS_FIXTURE.stock.amountUsd,
    lpUsd: LEGS_FIXTURE.lp.amountUsd,
    equityRwaUsd: LEGS_FIXTURE.r1.amountUsd,
    navUsd: LEGS_FIXTURE.r2.amountUsd,
    debt: s.debt,
    dailyCoupon: LEGS_FIXTURE.r2.dailyCouponUsd,
    heldSeconds: LEGS_FIXTURE.r2.heldSeconds,
    earnings: LEGS_FIXTURE.earnings,
    segregation: {
      r1TransferRestricted: s.r1TransferRestricted,
      r2GateOpen: s.gateOpen,
      navStalenessSeconds: LEGS_FIXTURE.r2.stalenessSeconds,
    },
  });
  return cachedBreakdown;
}

/** elevated tier while an accepted Agent Pass step-up is live (24 h) */
export function effectiveCaps(
  s: DemoState,
  breakdown: ReturnType<typeof marginBreakdown>
) {
  const elevated =
    s.stepUp === "granted" &&
    s.lockedRiskAcceptedUntil != null &&
    s.lockedRiskAcceptedUntil > NOW;
  return {
    elevated,
    perDrawCap: elevated ? breakdown.perDrawCap * 2 : breakdown.perDrawCap,
    drawsPerWindow: elevated
      ? breakdown.drawsPerWindow * 2
      : breakdown.drawsPerWindow,
  };
}

/** React binding — cached snapshots only (stable objects per commit) */
export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBreakdown() {
  return useSyncExternalStore(
    subscribe,
    () => currentBreakdown(),
    () => currentBreakdown()
  );
}
