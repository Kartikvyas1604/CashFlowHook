"use client";

/**
 * Overview — the dashboard (§6.8 screen 2, Quiet Pro presentation).
 * Four calm stat cards, collateral allocation with the unwindable /
 * earning-but-locked split, cashflow + StrategyScore, recent activity.
 * Every number is computed at runtime from §4.3 by lib/margin.ts.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AllocationBar,
  Badge,
  ButtonLink,
  Card,
  Empty,
  FOCUS,
  Stat,
} from "@/components/ui";
import { FEED, LEGS_FIXTURE, useBreakdown, useDemo } from "@/lib/demo";
import { delta, duration, fiat, pct, ratio, utcClock } from "@/lib/format";
import {
  FEE_CREDIT_CAP_FRAC,
  HC_LP,
  HC_R1,
  HC_R2,
  HC_STOCK,
  strategyScore,
  TAKER_FLOOR,
} from "@/lib/margin";

function HealthBar({ value, max = 2 }: { value: number; max?: number }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className="flex flex-col gap-1.5"
      role="img"
      aria-label={`health ${ratio(value)} against maintenance 0.85x`}
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-positive transition-[width] duration-150 motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
        <div
          title="maintenance floor 0.85x"
          className="absolute w-px inset-y-0 bg-warning"
          style={{ left: `${(0.85 / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { debt, receipts, gateOpen, r1TransferRestricted } = useDemo();
  const bd = useBreakdown();

  const stock = LEGS_FIXTURE.stock;
  const lp = LEGS_FIXTURE.lp;
  const r1 = LEGS_FIXTURE.r1;
  const r2 = LEGS_FIXTURE.r2;

  const haircutValues = [
    stock.amountUsd * HC_STOCK,
    lp.amountUsd * HC_LP,
    r1.amountUsd * HC_R1,
    r2.amountUsd * HC_R2,
  ];
  const haircutAll = haircutValues.reduce((a, b) => a + b, 0);
  const lockedReasons: string[] = [];
  if (r1TransferRestricted) lockedReasons.push("transfer restricted (I11)");
  if (!gateOpen) lockedReasons.push("gate shut (F17)");

  const score = strategyScore(LEGS_FIXTURE.earnings);
  const splitFrac = haircutAll > 0 ? bd.unwindableNow / haircutAll : 0;

  const segments = [
    {
      frac: haircutValues[0] / haircutAll,
      className: "bg-primary/70",
      label: `equity ${fiat(haircutValues[0], "compact")}`,
      title: `tokenized equity — haircuted ${fiat(haircutValues[0], "detailed")}, unwindable`,
    },
    {
      frac: haircutValues[1] / haircutAll,
      className: "bg-primary/35",
      label: `LP ${fiat(haircutValues[1], "compact")}`,
      title: `v4 LP — haircuted ${fiat(haircutValues[1], "detailed")}, unwinds via the atomic net`,
    },
    {
      frac: haircutValues[2] / haircutAll,
      className: "bg-warning/60",
      label: `R1 ${fiat(haircutValues[2], "compact")}`,
      title: "RWA equity — transfer restricted, earning but locked (I11)",
    },
    {
      frac: haircutValues[3] / haircutAll,
      className: gateOpen ? "bg-primary/90" : "bg-warning/60",
      label: `R2 ${fiat(haircutValues[3], "compact")}`,
      title: gateOpen
        ? `treasury NAV — haircuted ${fiat(haircutValues[3], "detailed")}, unwindable`
        : "treasury NAV — gate shut, earning but locked (F17)",
    },
    // visual order: locked legs render after the unwindable cluster
  ].sort(
    (a, b) =>
      Number(a.className.startsWith("bg-warning")) -
      Number(b.className.startsWith("bg-warning"))
  );

  return (
    <div className="flex flex-col gap-6">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            One margin grid over tokenized equity, a locked v4 LP position, and a
            treasury NAV signal — recomputed on every change.
          </p>
        </div>
        <Badge tone={bd.stressed ? "warning" : "positive"}>
          {bd.stressed ? "stressed — unwind eligible" : "healthy · within maintenance"}
        </Badge>
      </div>

      {/* stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Health" caption="stressed collateral over debt">
          <div className="flex flex-col gap-3">
            <span
              className={`font-mono text-[28px] tabular-nums leading-none ${
                bd.stressed ? "text-warning" : "text-foreground"
              }`}
            >
              {ratio(bd.health)}
            </span>
            <HealthBar value={bd.health} />
            <p className="text-xs text-muted-foreground">
              {bd.stressed
                ? "below 0.85x — unwind eligible"
                : "stays above the 0.85x maintenance floor"}
            </p>
          </div>
        </Card>

        <Card title="Borrowing power" caption="BP = floor(C_stressed × 0.80)">
          <Stat
            value={fiat(bd.bp, "detailed")}
            hint={`USDC · C_stressed ${fiat(bd.cStressed, "detailed")}`}
          />
        </Card>

        <Card title="Debt drawn" caption="Aqua virtual balance">
          <Stat
            value={fiat(debt, "detailed")}
            hint={`USDC · ${ratio(debt / bd.bp)} of BP used`}
          />
        </Card>

        <Card title="NAV accrual" caption="daily treasury coupon (BR3)">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-2xl tabular-nums leading-tight text-positive">
              +{fiat(r2.dailyCouponUsd)}
            </span>
            <span className="text-xs text-muted-foreground">
              per day · OUSG-class NAV · held{" "}
              {duration(FEED.now - FEED.lastAccrualTs)}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-5">
        {/* collateral */}
        <Card
          title="Collateral"
          caption={`marked ${fiat(bd.totalCollateralUsd, "detailed")} · haircuts ${pct(HC_STOCK * 100, { decimals: 0 })}/${pct(HC_LP * 100, { decimals: 0 })}/${pct(HC_R1 * 100, { decimals: 0 })}/${pct(HC_R2 * 100, { decimals: 0 })}`}
          className="lg:col-span-3"
        >
          <div className="flex flex-col gap-4">
            <AllocationBar segments={segments} />
            <ul className="flex flex-col">
              {[
                {
                  name: stock.label,
                  note: "tokenized equity",
                  value: haircutValues[0],
                  status: (
                    <Badge tone="positive">unwindable</Badge>
                  ),
                },
                {
                  name: lp.label,
                  note: `${lp.poolLabel}`,
                  value: haircutValues[1],
                  status: (
                    <Badge tone={debt > 0 ? "warning" : "positive"}>
                      {debt > 0 ? "hook-locked (I4)" : "unlocked"}
                    </Badge>
                  ),
                },
                {
                  name: r1.label,
                  note: "RWA equity",
                  value: haircutValues[2],
                  status: (
                    <Badge tone="warning">earning but locked</Badge>
                  ),
                },
                {
                  name: r2.label,
                  note: "RWA treasury",
                  value: haircutValues[3],
                  status: (
                    <Badge tone={gateOpen ? "positive" : "warning"}>
                      {gateOpen ? "unwindable" : "gate shut"}
                    </Badge>
                  ),
                },
              ].map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.note}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="font-mono text-[13px] tabular-nums">
                      {fiat(row.value, "detailed")}
                    </span>
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                unwindable now
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-[13px] tabular-nums text-positive">
                  {fiat(bd.unwindableNow, "detailed")}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {pct(splitFrac * 100, { decimals: 0 })} of haircuted value
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs text-muted-foreground">
                earning but locked{" "}
                {lockedReasons.length > 0 ? `· ${lockedReasons.join(", ")}` : ""}
              </span>
              <span className="font-mono text-[13px] tabular-nums text-warning">
                {fiat(bd.earningLocked, "detailed")}
              </span>
            </div>
          </div>
        </Card>

        {/* right rail */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card
            title="Cashflow underwriting"
            caption="7-day LP fee stream · borrower excluded (F6)"
          >
            <div className="flex items-end gap-1.5" aria-hidden="true">
              {LEGS_FIXTURE.earnings.feeSchedule.map((v) => (
                <span
                  key={v}
                  className="w-full rounded-sm bg-primary/40"
                  style={{ height: Math.max(6, Math.round((v / 1_120) * 44)) }}
                />
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">avg 7d fees</dt>
              <dd className="text-right font-mono tabular-nums">
                {fiat(LEGS_FIXTURE.earnings.avg7dFees)}/day
              </dd>
              <dt className="text-muted-foreground">distinct takers</dt>
              <dd className="text-right font-mono tabular-nums">
                {LEGS_FIXTURE.earnings.takers} (floor {TAKER_FLOOR})
              </dd>
              <dt className="text-muted-foreground">earnings credit</dt>
              <dd className="text-right font-mono tabular-nums">
                {fiat(bd.feeCreditBase, "detailed")}{" "}
                <span className="text-muted-foreground">
                  of {pct(FEE_CREDIT_CAP_FRAC * 100, { decimals: 0 })} cap
                </span>
              </dd>
            </dl>
          </Card>

          <Card
            title="StrategyScore"
            caption="StrategyBureau · append-only (I10)"
            action={<Badge tone="primary">{score} / 100</Badge>}
          >
            <p className="text-xs leading-5 text-muted-foreground">
              σ/μ {LEGS_FIXTURE.earnings.sigmaOverMu} · max weekly DD{" "}
              {pct(LEGS_FIXTURE.earnings.maxWeeklyDDfrac * 100, { decimals: 0 })} ·
              age {LEGS_FIXTURE.earnings.ageDays} days · gated by takers ≥{" "}
              {TAKER_FLOOR}.
            </p>
            <Link
              href="/agent"
              className={`mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:underline underline-offset-2 motion-reduce:transition-none ${FOCUS}`}
            >
              Open the agent view
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Card>

          <Card
            title="Recent activity"
            caption="every agent spend emits an AgentSpent record (I8)"
            action={
              <ButtonLink href="/agent" tone="ghost" size="sm">
                All runs
              </ButtonLink>
            }
          >
            {receipts.length === 0 ? (
              <Empty
                title="No activity yet"
                hint="Draws, repayments and x402 bills appear here as receipts."
                action={
                  <ButtonLink href="/agent" tone="secondary" size="sm">
                    Go to agent runs
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="flex flex-col">
                {receipts.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">
                        {r.rail === "x402"
                          ? "x402 bill paid"
                          : r.rail === "block"
                            ? "Draw reverted"
                            : r.rail === "step-up"
                              ? "Human step-up"
                              : r.rail === "owner-repay"
                                ? "Repaid"
                                : "Agent draw"}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {utcClock(r.ts)}
                      </span>
                    </span>
                    {r.amountUsd == null ? (
                      <Badge tone="neutral">recorded</Badge>
                    ) : r.reverted ? (
                      <Badge tone="destructive">no charge</Badge>
                    ) : (
                      <span className={`font-mono text-[13px] tabular-nums ${delta(-r.amountUsd).startsWith("+") ? "text-positive" : ""}`}>
                        {delta(-r.amountUsd, "detailed")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
