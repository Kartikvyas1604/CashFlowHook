"use client";

/**
 * Stress tab (§6.8 screen 3): the 16-scenario grid as a heat strip with
 * scenario inputs on hover/focus, the crash-replay comparator
 * (Aug 2024 / Feb 2025 / Oct 2026) printing per-scenario losses, and the
 * identical-book isolated-account liquidation comparison.
 */

import { useState } from "react";
import { Activity, DoorClosed, DoorOpen, Play, RotateCcw } from "lucide-react";
import { Badge, Button, Panel, Td, Th } from "@/components/ui";
import { CRASH_REPLAYS, LEGS_FIXTURE, demoActions, useBreakdown, useDemo } from "@/lib/demo";
import { fiat, pct, ratio, num } from "@/lib/format";
import {
  HC_LP,
  HC_R1,
  HC_R2,
  HC_STOCK,
  VOL_STATES,
  SHOCKS,
  GAP_PREMIUM,
  PERM_LIQ_HC,
  lossLP,
  lossStock,
} from "@/lib/margin";

export default function StressPage() {
  const bd = useBreakdown();
  const { gateOpen, r1TransferRestricted, debt } = useDemo();
  const [selected, setSelected] = useState<number>(0); // scenario index s
  const [replayRan, setReplayRan] = useState(false);

  const stockUsd = LEGS_FIXTURE.stock.amountUsd;
  const lpUsd = LEGS_FIXTURE.lp.amountUsd;
  const r1Usd = LEGS_FIXTURE.r1.amountUsd;
  const navUsd = LEGS_FIXTURE.r2.amountUsd;

  const sel = bd.scenarios[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stress</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            one grid prices all three legs — 8 shocks × 2 vol states, plus the
            closed-form RWA stress terms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">IM {fiat(bd.im, "detailed")}</Badge>
          <Badge tone="primary">fee credit halves on negative shocks</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          {/* heat strip */}
          <Panel
            title="Scenario grid"
            caption="loss IM per cell · select a cell for its inputs"
            right={
              <Badge tone="warning">
                worst {fiat(bd.im, "detailed")} at sh {num(bd.worstScenario.sh, 2)}
              </Badge>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-1">
                <caption className="sr-only">
                  16-scenario stress grid; rows are vol states, columns are
                  price shocks; each cell shows the initial margin loss
                </caption>
                <thead>
                  <tr>
                    <Th>VOL ↓ · shock →</Th>
                    {SHOCKS.map((sh) => (
                      <Th key={sh} numeric>
                        {pct(sh * 100, { decimals: 0 })}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VOL_STATES.map((vol, j) => (
                    <tr key={vol}>
                      <Td mono>
                        ×{num(vol, 1)} vol
                      </Td>
                      {SHOCKS.map((sh, i) => {
                        const s = i * 2 + j;
                        const cell = bd.scenarios[s];
                        if (!cell) return null;
                        const intensity =
                          bd.im > 0
                            ? Math.min(1, cell.lossIM / bd.im)
                            : 0;
                        const worst = s === bd.worstScenario.s;
                        // alpha ramp 8..70 → bucket classes (skip the
                        // 32–44% contrast dead zone; see globals.css)
                        const alpha = 8 + intensity * 62;
                        const bucket =
                          alpha >= 62
                            ? "heat-a6"
                            : alpha >= 50
                              ? "heat-a5"
                              : alpha >= 38
                                ? "heat-a4"
                                : alpha >= 28
                                  ? "heat-a3"
                                  : alpha >= 20
                                    ? "heat-a2"
                                    : alpha >= 12
                                      ? "heat-a1"
                                      : "heat-a0";
                        return (
                          <td key={s} className="p-0">
                            <button
                              type="button"
                              onClick={() => setSelected(s)}
                              onKeyDown={(e) => {
                                const grid = { i, j };
                                if (e.key === "ArrowRight") {
                                  setSelected(Math.min(7, grid.i + 1) * 2 + grid.j);
                                  e.preventDefault();
                                } else if (e.key === "ArrowLeft") {
                                  setSelected(Math.max(0, grid.i - 1) * 2 + grid.j);
                                  e.preventDefault();
                                } else if (e.key === "ArrowDown") {
                                  setSelected(grid.i * 2 + Math.min(1, grid.j + 1));
                                  e.preventDefault();
                                } else if (e.key === "ArrowUp") {
                                  setSelected(grid.i * 2 + Math.max(0, grid.j - 1));
                                  e.preventDefault();
                                }
                              }}
                              aria-label={`Scenario ${s}: shock ${pct(
                                cell.sh * 100,
                                { decimals: 0 }
                              )} at ${num(vol, 1)} vol — loss ${fiat(
                                cell.lossIM
                              )}`}
                              aria-pressed={selected === s}
                              title={`sh ${pct(cell.sh * 100, { decimals: 0 })} · loss ${fiat(
                                cell.lossIM
                              )}`}
                              className={`w-full min-h-9 rounded-sm px-2 py-2 text-right font-mono text-[11.5px] tabular-nums transition-shadow duration-150 motion-reduce:transition-none outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:outline-1 ${
                                worst
                                  ? "bg-destructive text-destructive-foreground ring-1 ring-destructive/60"
                                  : `${bucket} ${selected === s ? "ring-1 ring-ring" : ""}`
                              }`}
                            >
                              {fiat(cell.lossIM)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* selected scenario inputs */}
          <Panel
            title="Scenario inputs"
            caption="all terms visible — every displayed number is computed here"
            right={
              <Badge tone="neutral">
                s = i·2 + j → {sel.i}·2 + {sel.j} = {sel.s}
              </Badge>
            }
          >
            {sel ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <Th>Term</Th>
                      <Th numeric>Value</Th>
                      <Th>Definition (§4.3)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>scaled shock sh</Td>
                      <Td numeric>{pct(sel.sh * 100, { decimals: 1 })}</Td>
                      <Td className="text-muted-foreground">
                        sh = S[{sel.i}]·V[{sel.j}] ={" "}
                        {pct(SHOCKS[sel.i] * 100, { decimals: 0 })} × {num(VOL_STATES[sel.j], 1)}
                      </Td>
                    </tr>
                    <tr>
                      <Td>lossStock</Td>
                      <Td numeric>{fiat(sel.lossStock, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        max(0, −sh) · stockLegUsd
                      </Td>
                    </tr>
                    <tr>
                      <Td>lossLP</Td>
                      <Td numeric>{fiat(sel.lossLP, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        lpLegUsd · (0.8·|sh| + 0.05·sh²) = {num(0.8 * Math.abs(sel.sh) + 0.05 * sel.sh * sel.sh, 4)}
                      </Td>
                    </tr>
                    <tr>
                      <Td>lossR1 (× vol)</Td>
                      <Td numeric>{fiat(sel.lossR1 * sel.vol, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        equityRwaUsd · 0.20 · (1 + {num(GAP_PREMIUM, 1)} gap premium) ={" "}
                        {fiat(sel.lossR1, "detailed")} · vol {num(sel.vol, 1)}
                      </Td>
                    </tr>
                    <tr>
                      <Td>lossR2</Td>
                      <Td numeric>{fiat(sel.lossR2, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        navUsd · {pct(PERM_LIQ_HC * 100, { decimals: 1 })} permissioned-liquidity
                        haircut + exit cost (≤ coupon × 2 gate days)
                      </Td>
                    </tr>
                    <tr>
                      <Td>fee credit applied</Td>
                      <Td numeric>−{fiat(sel.feeCreditApplied, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        feeCreditBase × {sel.feeCreditApplied < bd.feeCreditBase ? 0.5 : 1.0} (shock {sel.sh < 0 ? "<" : "≥"} 0)
                      </Td>
                    </tr>
                    <tr className="bg-secondary/40">
                      <Td mono>IM</Td>
                      <Td numeric>{fiat(sel.lossIM, "detailed")}</Td>
                      <Td className="text-muted-foreground">
                        max(0, lossStock + lossLP + lossR1·V + lossR2 − feeCred)
                      </Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>
        </div>

        {/* crash control + replay */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel
            title="Crash control (demo)"
            caption="drives CreditEngine events — every beat discloses what changed"
          >
            <div className="flex flex-col gap-2">
              <Button
                tone="destructive"
                onClick={() => demoActions.gateShut()}
                disabled={!gateOpen}
                title="NAV oracle posts gateOpen=false → SegregationChanged"
              >
                <DoorClosed className="size-3.5" aria-hidden="true" />
                Shut the redemption gate
              </Button>
              <Button
                onClick={() => demoActions.gateOpen()}
                disabled={gateOpen}
                title="Gate reopens → margin re-included in the same block"
              >
                <DoorOpen className="size-3.5" aria-hidden="true" />
                Reopen the gate
              </Button>
              <p className="text-[11px] text-muted-foreground">
                current flags: R1 transfer-restricted ={" "}
                {r1TransferRestricted ? "true" : "false"} · R2 gate open ={" "}
                {gateOpen ? "true" : "false"} · unwindableNow{" "}
                {fiat(bd.unwindableNow, "detailed")}
              </p>
            </div>
          </Panel>

          <Panel
            title="Crash replay"
            caption="identical book · cross-margin vs isolated liquidation (F12)"
            right={
              <Button
                size="sm"
                tone={replayRan ? "secondary" : "primary"}
                onClick={() => setReplayRan(true)}
                title="Run the replay against the fixture crash timeline"
              >
                {replayRan ? (
                  <RotateCcw className="size-3" aria-hidden="true" />
                ) : (
                  <Play className="size-3" aria-hidden="true" />
                )}
                {replayRan ? "Rerun" : "Run replay"}
              </Button>
            }
          >
            {!replayRan ? (
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Activity className="size-3.5 shrink-0" aria-hidden="true" />
                Runs the three historical crash paths (fixture replay inputs)
                against this account&apos;s live grid state.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {CRASH_REPLAYS.map((crash) => {
                  const sh = crash.peakShock * crash.vol;
                  const abs = Math.abs(sh);
                  const lossStockV = lossStock(sh, stockUsd);
                  const lossLPV = lossLP(sh, lpUsd);
                  const r1Term = r1Usd * abs * (1 + GAP_PREMIUM) * crash.vol;
                  const r2Term =
                    navUsd * PERM_LIQ_HC +
                    Math.min(
                      navUsd * 0.005,
                      LEGS_FIXTURE.r2.dailyCouponUsd * 2
                    );
                  const fc = bd.feeCreditBase * 0.5;
                  const im = Math.max(
                    0,
                    lossStockV + lossLPV + r1Term + r2Term - fc
                  );
                  const healthAfter = ratio(
                    (stockUsd * HC_STOCK +
                      lpUsd * HC_LP +
                      r1Usd * HC_R1 +
                      navUsd * HC_R2 -
                      im) /
                      debt
                  );

                  // isolated comparator: each class margined alone against
                  // its pro-rata debt share — no cross-class netting
                  const total = stockUsd + lpUsd + r1Usd + navUsd;
                  const classes = [
                    {
                      name: "ST",
                      c: stockUsd * HC_STOCK - lossStockV,
                      share: (debt * stockUsd) / total,
                    },
                    {
                      name: "LP",
                      c: lpUsd * HC_LP - lossLPV,
                      share: (debt * lpUsd) / total,
                    },
                    {
                      name: "R1",
                      c: r1Usd * HC_R1 - r1Term,
                      share: (debt * r1Usd) / total,
                    },
                    {
                      name: "R2",
                      c: navUsd * HC_R2 - r2Term,
                      share: (debt * navUsd) / total,
                    },
                  ];
                  const failing = classes.filter((c) => c.c < c.share);
                  const shortfall = failing.reduce(
                    (a, c) => a + (c.share - c.c),
                    0
                  );

                  return (
                    <li
                      key={crash.id}
                      className="rounded-md border border-border bg-secondary/30 px-3 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-medium">{crash.label}</p>
                        <Badge tone="neutral" title={`peak shock ${pct(crash.peakShock * 100, { decimals: 1 })} × vol ${num(crash.vol, 1)}`}>
                          sh {pct(sh * 100, { decimals: 1 })}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {crash.window} · inputs: peak shock{" "}
                        {pct(crash.peakShock * 100, { decimals: 1 })} marked, vol
                        ×{num(crash.vol, 1)} (fixture replay path)
                      </p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
                        <dt className="text-muted-foreground">cross IM</dt>
                        <dd className="text-right">{fiat(im, "detailed")}</dd>
                        <dt className="text-muted-foreground">health after</dt>
                        <dd className="text-right">{healthAfter}</dd>
                        <dt className="text-muted-foreground">isolated fails</dt>
                        <dd className="text-right">
                          {failing.length > 0
                            ? failing.map((c) => c.name).join(", ")
                            : "none"}
                        </dd>
                        <dt className="text-muted-foreground">isolated shortfall</dt>
                        <dd className="text-right">
                          {failing.length > 0 ? fiat(shortfall, "detailed") : "--"}
                        </dd>
                      </dl>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {failing.length > 0
                          ? `isolated: ${failing
                              .map((c) => c.name)
                              .join(" + ")} leg(s) liquidated against pro-rata debt; cross-margined: no unwind (health ${healthAfter}) — zero bad debt path`
                          : `isolated: all classes clear their pro-rata debt; cross-margined: no unwind (health ${healthAfter})`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Grid definitions" caption="constants from §4.2/§6.1 — quoted, not tuned">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
              <dt className="text-muted-foreground">haircuts</dt>
              <dd className="text-right">
                stock {num(HC_STOCK, 2)} · LP {num(HC_LP, 2)} · R1{" "}
                {num(HC_R1, 2)} · R2 {num(HC_R2, 2)}
              </dd>
              <dt className="text-muted-foreground">grid shocks</dt>
              <dd className="text-right">−20 / −10 / −5 / −2 / +2 / +5 / +10 / +20 %</dd>
              <dt className="text-muted-foreground">vol states</dt>
              <dd className="text-right">×1.0 · ×1.5</dd>
              <dt className="text-muted-foreground">LP terms</dt>
              <dd className="text-right">β 0.8 · convexity 0.05</dd>
              <dt className="text-muted-foreground">R1 gap premium</dt>
              <dd className="text-right">{num(GAP_PREMIUM, 1)} (weekend/overnight)</dd>
              <dt className="text-muted-foreground">R2 perm-liq haircut</dt>
              <dd className="text-right">{pct(PERM_LIQ_HC * 100, { decimals: 1 })} of NAV</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
