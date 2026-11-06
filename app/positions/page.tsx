"use client";

/**
 * Positions — the book, presented as a simple table.
 * Each row covers by itself: what it is, its class, its haircuted value,
 * and whether it can back an unwind. Detail lines carry mark/qty so the
 * table stays four columns (Quiet Pro rule: one idea per card).
 */

import { Badge, Card, Empty, FOCUS, Th, Td } from "@/components/ui";
import { FEED, LEGS_FIXTURE, useBreakdown, useDemo } from "@/lib/demo";
import { duration, fiat, num, pct, ratio, utcClock } from "@/lib/format";
import { HC_LP, HC_R1, HC_R2, HC_STOCK } from "@/lib/margin";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function PositionsPage() {
  const { debt, gateOpen, r1TransferRestricted } = useDemo();
  const bd = useBreakdown();

  const haircut = (usd: number, hc: number) => usd * hc;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Positions</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Four legs cross-margined under one grid. Assets that can&apos;t exit
            instantly never back an unwind — segregation is by construction, not
            by promise.
          </p>
        </div>
        <Badge tone="neutral">
          debt {fiat(debt, "detailed")} · health {ratio(bd.health)}
        </Badge>
      </div>

      <Card
        title="The book"
        caption={`marked ${fiat(bd.totalCollateralUsd, "detailed")} · unwindable ${fiat(bd.unwindableNow, "detailed")}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">
              Collateral positions with haircuted values and unwind eligibility
            </caption>
            <thead>
              <tr>
                <Th>Asset</Th>
                <Th>Class</Th>
                <Th numeric>Haircuted value</Th>
                <Th>Eligibility</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="transition-colors duration-100 hover:bg-secondary/30 motion-reduce:transition-none">
                <Td>
                  <span className="block">{LEGS_FIXTURE.stock.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    mark {fiat(LEGS_FIXTURE.stock.mark, "detailed")} ·{" "}
                    {num(LEGS_FIXTURE.stock.shares, 2)} shares · haircut{" "}
                    {pct(HC_STOCK * 100, { decimals: 0 })} · record{" "}
                    {utcClock(FEED.stockMarkTs)}
                  </span>
                </Td>
                <Td>equity</Td>
                <Td numeric>{fiat(haircut(LEGS_FIXTURE.stock.amountUsd, HC_STOCK), "detailed")}</Td>
                <Td>
                  <Badge tone="positive">unwindable</Badge>
                </Td>
              </tr>
              <tr className="transition-colors duration-100 hover:bg-secondary/30 motion-reduce:transition-none">
                <Td>
                  <span className="block">{LEGS_FIXTURE.lp.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {LEGS_FIXTURE.lp.poolLabel} · {LEGS_FIXTURE.lp.tokenIdLabel} ·
                    haircut {pct(HC_LP * 100, { decimals: 0 })} · removal reverts
                    SpanMarginBreach while debt {">"} 0 (I4)
                  </span>
                </Td>
                <Td>LP · strategy</Td>
                <Td numeric>{fiat(haircut(LEGS_FIXTURE.lp.amountUsd, HC_LP), "detailed")}</Td>
                <Td>
                  <Badge tone={debt > 0 ? "warning" : "positive"}>
                    {debt > 0 ? "hook-locked · net-exit" : "unlocked"}
                  </Badge>
                </Td>
              </tr>
              <tr className="transition-colors duration-100 hover:bg-secondary/30 motion-reduce:transition-none">
                <Td>
                  <span className="block">{LEGS_FIXTURE.r1.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    mark {fiat(LEGS_FIXTURE.r1.mark, "detailed")} ·{" "}
                    {num(LEGS_FIXTURE.r1.shares, 2)} shares · haircut{" "}
                    {pct(HC_R1 * 100, { decimals: 0 })} · coupon $0.00 (dividend
                    treatment unverified — disclosed)
                  </span>
                </Td>
                <Td>RWA · equity</Td>
                <Td numeric>{fiat(haircut(LEGS_FIXTURE.r1.amountUsd, HC_R1), "detailed")}</Td>
                <Td>
                  <Badge tone="warning">
                    {r1TransferRestricted
                      ? "transfer restricted (I11)"
                      : "unwindable"}
                  </Badge>
                </Td>
              </tr>
              <tr className="transition-colors duration-100 hover:bg-secondary/30 motion-reduce:transition-none">
                <Td>
                  <span className="block">{LEGS_FIXTURE.r2.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    NAV share {fiat(LEGS_FIXTURE.r2.navPerShare, "detailed")} ·{" "}
                    {num(LEGS_FIXTURE.r2.shares, 2)} shares · haircut{" "}
                    {pct(HC_R2 * 100, { decimals: 0 })} · record{" "}
                    {utcClock(FEED.navTs)} · daily coupon{" "}
                    {fiat(LEGS_FIXTURE.r2.dailyCouponUsd)}
                  </span>
                </Td>
                <Td>RWA · treasury</Td>
                <Td numeric>{fiat(haircut(LEGS_FIXTURE.r2.amountUsd, HC_R2), "detailed")}</Td>
                <Td>
                  <Badge tone={gateOpen ? "positive" : "warning"}>
                    {gateOpen ? "unwindable · under cap" : "gate shut (F17)"}
                  </Badge>
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
        {bd.earningLocked > 0 ? (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Earning but locked: {fiat(bd.earningLocked, "detailed")} earns credit
            today yet never backs an unwind. Unlocking it requires a verified
            human accepting locked-leg liquidity risk (I13).
          </p>
        ) : null}
      </Card>

      <Card title="Draws and caps" caption="hard caps the agent cannot raise alone (I7)">
        <ul className="flex flex-col">
          <li className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0">
            <span className="text-[13px]">per-draw cap (2% of borrowing power)</span>
            <span className="font-mono text-[13px] tabular-nums">
              {fiat(bd.perDrawCap, "detailed")}
            </span>
          </li>
          <li className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0">
            <span className="text-[13px]">draws per 12 h window</span>
            <span className="font-mono text-[13px] tabular-nums">3</span>
          </li>
          <li className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0">
            <span className="text-[13px]">maintenance</span>
            <span className="font-mono text-[13px] tabular-nums">{ratio(0.85)}</span>
          </li>
          <li className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-[13px]">coupon held toward accrual credit</span>
            <span className="font-mono text-[13px] tabular-nums">
              {duration(FEED.now - FEED.lastAccrualTs)}
            </span>
          </li>
        </ul>
        <Link
          href="/agent"
          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:underline underline-offset-2 motion-reduce:transition-none ${FOCUS}`}
        >
          Draw and repay on the agent view
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Card>

      {bd.stressed ? (
        <Empty
          title="Account is stressed"
          hint="Health is below maintenance — the atomic unwind instruction is eligible. Review stress tests."
        />
      ) : null}
    </div>
  );
}
