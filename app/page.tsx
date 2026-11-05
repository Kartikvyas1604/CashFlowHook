"use client";

/**
 * Credit Desk — the two-column book (§6.8 screen 2):
 * live health, BP, debt; collateral-mix bar with the unwindable /
 * earning-but-locked split; legs table; autonomy + receipts rail.
 */

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Gauge as GaugeIcon,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  Delta,
  Gauge,
  Panel,
  SegmentedBar,
  Td,
  Th,
} from "@/components/ui";
import { FEED, LEGS_FIXTURE, demoActions, effectiveCaps, useBreakdown, useDemo } from "@/lib/demo";
import { duration, fiat, num, pct, ratio, utcClock } from "@/lib/format";
import {
  AUTONOMY_CAP_PCT,
  TAKER_FLOOR,
  HC_LP,
  HC_R1,
  HC_R2,
  HC_STOCK,
  strategyScore,
} from "@/lib/margin";

export default function CreditDeskPage() {
  const demo = useDemo();
  const { debt, draws, receipts, gateOpen, r1TransferRestricted, stepUp } = demo;
  const bd = useBreakdown();
  const caps = effectiveCaps(demo, bd);

  const stock = LEGS_FIXTURE.stock;
  const lp = LEGS_FIXTURE.lp;
  const r1 = LEGS_FIXTURE.r1;
  const r2 = LEGS_FIXTURE.r2;

  const haircut = [stock.amountUsd * HC_STOCK, lp.amountUsd * HC_LP, r1.amountUsd * HC_R1, r2.amountUsd * HC_R2];
  const haircutAll = haircut.reduce((a, b) => a + b, 0);
  const splitFrac = haircutAll > 0 ? bd.unwindableNow / haircutAll : 0;

  // segments ordered: unwindable cluster first, locked cluster second —
  // the split line then sits at the exact cluster boundary
  const lockedReasons: string[] = [];
  if (r1TransferRestricted) lockedReasons.push("transfer restricted (I11)");
  if (!gateOpen) lockedReasons.push("gate shut (F17)");

  const health = ratio(bd.health);
  const isStressed = bd.stressed;
  const drawsUsed = draws.filter((d) => FEED.now - d.ts <= 12 * 3600).length;
  const windowResetsIn = 12 * 3600 - (FEED.now - FEED.windowStartTs) % (12 * 3600);

  const score = strategyScore(LEGS_FIXTURE.earnings);

  return (
    <div className="flex flex-col gap-4">
      {/* page head */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credit Desk</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            demo account (fixture) · all numbers computed at runtime by the
            margin grid — inputs remain visible on every panel
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStressed ? (
            <Badge tone="warning">
              STRESSED — unwind eligible below {ratio(0.85)}
            </Badge>
          ) : (
            <Badge tone="positive">
              <ShieldCheck className="size-3" aria-hidden="true" />
              within maintenance
            </Badge>
          )}
          <Badge tone="neutral">health {health}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* ------------------------------------------------ main book */}
        <div className="flex flex-col gap-4 xl:col-span-8">
          {/* row 1 — the five desk stats, one anatomy each */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Panel title="Health" caption="stressed collateral vs debt">
              <div className="flex flex-col gap-2">
                <span
                  className={`font-mono text-2xl tabular-nums ${
                    isStressed ? "text-warning" : "text-foreground"
                  }`}
                >
                  {health}
                </span>
                <Gauge
                  value={bd.health}
                  max={2}
                  marks={[{ at: 0.85, label: "maintenance 0.85x", tone: "warning" }]}
                  tone={isStressed ? "warning" : "positive"}
                  valueText={health}
                  aria={`health ${health} vs maintenance 0.85x`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {isStressed
                    ? "below 0.85x → unwind eligible"
                    : "maintenance floor 0.85x"}
                </span>
              </div>
            </Panel>

            <Panel title="Borrowing power" caption="BP = floor(C_stressed × 0.80)">
              <span className="font-mono text-[15px] tabular-nums">
                {fiat(bd.bp, "detailed")}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                USDC · C_stressed {fiat(bd.cStressed, "detailed")}
              </p>
            </Panel>

            <Panel title="Debt drawn" caption="Aqua virtual balance liability">
              <span className="font-mono text-[15px] tabular-nums">
                {fiat(debt, "detailed")}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                USDC · {ratio(debt / bd.bp)} of BP
              </p>
            </Panel>

            <Panel title="NAV accrual" caption="daily treasury coupon (BR3)">
              <span className="font-mono text-[15px] tabular-nums text-positive">
                +{fiat(r2.dailyCouponUsd)}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                per day · OUSG-class NAV · held{" "}
                {duration(FEED.now - FEED.lastAccrualTs)}
              </p>
            </Panel>

            <Panel title="Earnings credit" caption="LP fees + accrual, combined cap">
              <span className="font-mono text-[15px] tabular-nums">
                {fiat(bd.feeCreditBase, "detailed")}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                of 10% cap {fiat(bd.feeCreditCap)} on collateral
              </p>
            </Panel>
          </div>

          {/* collateral mix — the segregation story */}
          <Panel
            title="Collateral mix"
            caption={`haircut values by leg · marked ${fiat(
              bd.totalCollateralUsd,
              "detailed"
            )} — split line sits at unwindableNow`}
            right={
              <div className="flex items-center gap-1.5">
                <Badge tone="positive">unwindable {fiat(bd.unwindableNow, "detailed")}</Badge>
                <Badge
                  tone="warning"
                  title={
                    lockedReasons.length
                      ? `locked: ${lockedReasons.join("; ")}`
                      : "nothing locked"
                  }
                >
                  <Lock className="size-3" aria-hidden="true" />
                  earning but locked {fiat(bd.earningLocked, "detailed")}
                </Badge>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <SegmentedBar
                splitFrac={splitFrac}
                segments={[
                  {
                    frac: haircut[0] / haircutAll,
                    tone: "bg-primary/60",
                    label: `ST ${fiat(haircut[0], "compact")}`,
                    title: `Stock leg haircuted ${fiat(haircut[0], "detailed")} — unwindable`,
                  },
                  {
                    frac: haircut[1] / haircutAll,
                    tone: "bg-primary/35",
                    label: `LP ${fiat(haircut[1], "compact")}`,
                    title: `LP leg haircuted ${fiat(haircut[1], "detailed")} — unwindable via atomic net (removal reverts SpanMarginBreach while debt > 0)`,
                  },
                  // locked cluster (renders after the split line)
                  {
                    frac: haircut[2] / haircutAll,
                    tone: "bg-warning/50",
                    label: `R1 ${fiat(haircut[2], "compact")}`,
                    title:
                      "RWA equity leg — transfer restricted → never backs an unwind (I11)",
                  },
                  {
                    frac: haircut[3] / haircutAll,
                    tone: gateOpen ? "bg-primary/80" : "bg-warning/50",
                    label: `R2 ${fiat(haircut[3], "compact")}`,
                    title: gateOpen
                      ? "Treasury leg — gate open and under the daily cap → unwindable"
                      : "Treasury leg — gate shut → earning but locked (F17)",
                  },
                ].sort((a, b) => Number(a.tone.startsWith("bg-warning")) - Number(b.tone.startsWith("bg-warning")))}
              />
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-primary/60" aria-hidden="true" />
                  ST equity · haircut {pct(HC_STOCK * 100, { decimals: 0 })}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-primary/35" aria-hidden="true" />
                  LP position · haircut {pct(HC_LP * 100, { decimals: 0 })} · beta 0.8 / convexity 0.05
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-warning/50" aria-hidden="true" />
                  RWA equity · restricted assets can&apos;t back an unwind
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-sm ${gateOpen ? "bg-primary/80" : "bg-warning/50"}`}
                    aria-hidden="true"
                  />
                  Treasury NAV · gate {gateOpen ? "open" : "shut"} · OUSG instant cap $25M/investor/24h
                </li>
              </ul>
            </div>
          </Panel>

          {/* legs table */}
          <Panel
            title="Legs"
            caption="marks, haircuts and per-leg eligibility — TWAP 30 min window"
            right={
              <Badge tone={r1TransferRestricted ? "warning" : "primary"}>
                R1 {r1TransferRestricted ? "transfer restricted" : "transferable"}
              </Badge>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <Th>Leg</Th>
                    <Th>Class</Th>
                    <Th numeric>Mark</Th>
                    <Th numeric>Quantity</Th>
                    <Th numeric>Haircut</Th>
                    <Th numeric>Haircuted value</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="transition-colors duration-100 hover:bg-secondary/40 motion-reduce:transition-none">
                    <Td>Tokenized stock · Base</Td>
                    <Td>equity</Td>
                    <Td numeric>{fiat(stock.mark, "detailed")}</Td>
                    <Td numeric>{num(stock.shares, 5)} shares</Td>
                    <Td numeric>{pct(HC_STOCK * 100, { decimals: 0 })}</Td>
                    <Td numeric>{fiat(haircut[0], "detailed")}</Td>
                    <Td>
                      <Badge tone="primary">unwindable</Badge>
                    </Td>
                  </tr>
                  <tr className="transition-colors duration-100 hover:bg-secondary/40 motion-reduce:transition-none">
                    <Td>
                      {lp.label}{" "}
                      <span className="text-[11px] text-muted-foreground">
                        {lp.poolLabel} · {lp.tokenIdLabel}
                      </span>
                    </Td>
                    <Td>lp · strategy</Td>
                    <Td numeric>--</Td>
                    <Td numeric>--</Td>
                    <Td numeric>{pct(HC_LP * 100, { decimals: 0 })}</Td>
                    <Td numeric>{fiat(haircut[1], "detailed")}</Td>
                    <Td>
                      <Badge tone={debt > 0 ? "warning" : "positive"}>
                        {debt > 0 ? "hook-locked · removal reverts SpanMarginBreach (I4)" : "unlocked"}
                      </Badge>{" "}
                      <Badge tone="primary" title="unwinds atomically via the net instruction">
                        net-exit
                      </Badge>
                    </Td>
                  </tr>
                  <tr className="transition-colors duration-100 hover:bg-secondary/40 motion-reduce:transition-none">
                    <Td>
                      {r1.label}{" "}
                      <span className="text-[11px] text-muted-foreground">
                        coupon $0.00 — dividend treatment unverified, disclosed
                      </span>
                    </Td>
                    <Td>rwa · equity</Td>
                    <Td numeric>{fiat(r1.mark, "detailed")}</Td>
                    <Td numeric>{num(r1.shares, 5)} shares</Td>
                    <Td numeric>{pct(HC_R1 * 100, { decimals: 0 })}</Td>
                    <Td numeric>{fiat(haircut[2], "detailed")}</Td>
                    <Td>
                      <Badge
                        tone="warning"
                        title="eligR1 = 0 — restricted tokens never count toward unwindableNow (I11)"
                      >
                        earning but locked · transfer restricted
                      </Badge>
                    </Td>
                  </tr>
                  <tr className="transition-colors duration-100 hover:bg-secondary/40 motion-reduce:transition-none">
                    <Td>
                      {r2.label}{" "}
                      <span className="text-[11px] text-muted-foreground">
                        NAV share {fiat(r2.navPerShare, "detailed")} · last record{" "}
                        {utcClock(FEED.navTs)}
                      </span>
                    </Td>
                    <Td>rwa · treasury</Td>
                    <Td numeric>{fiat(r2.navPerShare, "detailed")}</Td>
                    <Td numeric>{num(r2.shares, 5)} shares</Td>
                    <Td numeric>{pct(HC_R2 * 100, { decimals: 0 })}</Td>
                    <Td numeric>{fiat(haircut[3], "detailed")}</Td>
                    <Td>
                      <Badge tone={gateOpen ? "primary" : "warning"}>
                        {gateOpen
                          ? "unwindable · under the daily cap"
                          : "earning but locked · gate shut"}
                      </Badge>{" "}
                      <Badge tone="neutral" title="source tx pinned per NAV record (BR3)">
                        source tx pinned
                      </Badge>
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* ------------------------------------------------ side rail */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          {/* autonomy */}
          <Panel
            title="Autonomy"
            caption="agent draws within hard caps — raising either cap requires a verified human (I7)"
            right={
              <Badge tone={drawsUsed >= caps.drawsPerWindow ? "warning" : "neutral"}>
                {drawsUsed}/{caps.drawsPerWindow} draws · 12 h
              </Badge>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  per-draw cap ({pct(AUTONOMY_CAP_PCT * 100, { decimals: 0 })} of BP)
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {fiat(caps.perDrawCap, "detailed")}
                  {caps.elevated ? " · ×2 tier" : ""}
                </span>
              </div>
              <Gauge
                value={drawsUsed}
                max={caps.drawsPerWindow}
                tone={drawsUsed >= caps.drawsPerWindow ? "warning" : "primary"}
                aria={`draws used ${drawsUsed} of ${caps.drawsPerWindow} per 12 h window`}
                marks={[{ at: caps.drawsPerWindow, label: `${caps.drawsPerWindow} draws / 12 h`, tone: "warning" }]}
              />
              <p className="text-[11px] text-muted-foreground">
                window resets in {duration(windowResetsIn)} · draw #
                {caps.drawsPerWindow + 1} reverts{" "}
                <code className="font-mono text-[11px]">CapExceededBlock</code>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  tone="primary"
                  onClick={() => demoActions.draw(caps.perDrawCap)}
                  title="Agent draw at the full per-draw cap"
                >
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  Agent draw · {fiat(caps.perDrawCap, "detailed")}
                </Button>
                <Button
                  onClick={() => demoActions.repay(2_000)}
                  title="Owner repay $2,000 USDC"
                >
                  <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  Repay $2,000
                </Button>
                <Button
                  size="sm"
                  tone="ghost"
                  className="col-span-2 justify-center"
                  onClick={() => demoActions.simulateFourthDraw()}
                  title="Runs the engine's window check and shows the revert"
                >
                  <Flame className="size-3.5" aria-hidden="true" />
                  Simulate the agent&apos;s 4th draw
                </Button>
              </div>
              {isStressed || !gateOpen ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                  <p className="text-[12px] text-foreground">
                    {stepUp === "granted"
                      ? "Elevated tier active until expiry (24 h)."
                      : "Capped: debt exceeds 0.80 × unwindableNow. Unwinding past the liquidatable backing needs a human."}
                  </p>
                  {stepUp !== "granted" ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Button
                        tone="destructive"
                        size="sm"
                        onClick={() => demoActions.requestStepUp()}
                      >
                        <GaugeIcon className="size-3.5" aria-hidden="true" />
                        Request step-up
                      </Button>
                      <Link
                        href="/agent"
                        className="text-[11px] text-muted-foreground underline-offset-2 outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:text-foreground motion-reduce:transition-none"
                      >
                        run on the Agent tab →
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Panel>

          {/* fee stream */}
          <Panel
            title="Cashflow underwriting"
            caption="7-day LP fee stream — distinct takers, borrower excluded (F6)"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-1" aria-hidden="true">
                {LEGS_FIXTURE.earnings.feeSchedule.map((v) => {
                  const h = Math.max(6, Math.round((v / 1_120) * 40));
                  return (
                    <span
                      key={v}
                      className="w-full rounded-sm bg-primary/40"
                      style={{ height: h }}
                    />
                  );
                })}
              </div>
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span aria-hidden="false" className="sr-only">
                  daily LP fees for the last 7 days
                </span>
                <span>avg {fiat(LEGS_FIXTURE.earnings.avg7dFees)}/day</span>
                <span>last 7 days · 3× avg = {fiat(LEGS_FIXTURE.earnings.avg7dFees * 3)}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">Distinct takers</dt>
                  <dd className="font-mono tabular-nums">
                    {LEGS_FIXTURE.earnings.takers}{" "}
                    <span className="text-muted-foreground">
                      (floor {TAKER_FLOOR})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">σ/μ</dt>
                  <dd className="font-mono tabular-nums">
                    {num(LEGS_FIXTURE.earnings.sigmaOverMu, 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max weekly DD</dt>
                  <dd className="font-mono tabular-nums">
                    {pct(LEGS_FIXTURE.earnings.maxWeeklyDDfrac * 100, { decimals: 0 })}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground">
                multipliers: sybil min(1, {LEGS_FIXTURE.earnings.takers}/20) = 1.00 ·
                vol (1 − 0.5·{num(LEGS_FIXTURE.earnings.sigmaOverMu, 2)}) = 0.875 ·
                dd (1 − 0.3·{num(LEGS_FIXTURE.earnings.maxWeeklyDDfrac, 2)}) = 0.916
              </p>
            </div>
          </Panel>

          {/* StrategyScore — formula verbatim (§6.8) */}
          <Panel
            title="StrategyScore"
            caption="computed by StrategyBureau · append-only history (I10)"
            right={
              score == null ? (
                <Badge tone="warning">below taker floor — score 0</Badge>
              ) : (
                <Badge tone="primary">{score} / 100</Badge>
              )
            }
          >
            <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-[11px] leading-5">
              score = min(100, round(100·(0.5·(1 − min(1,σ/μ)) + 0.3·(1 −
              maxWeeklyDDfrac) + 0.2·min(1, ageDays/7))))
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              σ/μ {num(LEGS_FIXTURE.earnings.sigmaOverMu, 2)} · maxWeeklyDDfrac{" "}
              {num(LEGS_FIXTURE.earnings.maxWeeklyDDfrac, 2)} · ageDays{" "}
              {LEGS_FIXTURE.earnings.ageDays} · gated by takers ≥ {TAKER_FLOOR} (currently{" "}
              {LEGS_FIXTURE.earnings.takers})
            </p>
          </Panel>

          {/* receipts */}
          <Panel
            title="Receipts"
            caption="every agent spend emits an AgentSpent record (I8)"
          >
            {receipts.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No receipts yet — every agent spend emits an AgentSpent record.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {receipts.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 transition-colors duration-100 motion-reduce:transition-none ${
                      r.reverted
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[12px]">
                        {r.rail === "x402" ? (
                          <Badge tone="primary">x402</Badge>
                        ) : r.rail === "block" ? (
                          <Badge tone="destructive">reverted</Badge>
                        ) : r.rail === "step-up" ? (
                          <Badge tone={r.memo.includes("denied") ? "warning" : "positive"}>
                            Agent Pass
                          </Badge>
                        ) : (
                          <Badge tone="neutral">{r.rail}</Badge>
                        )}
                        <span className="truncate">{r.memo}</span>
                      </p>
                      <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                        {r.toLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {r.amountUsd == null ? (
                        <span className="text-muted-foreground">--</span>
                      ) : (
                        <Delta value={r.reverted ? null : -r.amountUsd} context="detailed" />
                      )}
                      <p className="font-mono text-[10.5px] text-muted-foreground">
                        {utcClock(r.ts)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
