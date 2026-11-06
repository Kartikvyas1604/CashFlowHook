"use client";

/**
 * Stress tests (§6.8 screen 3, Quiet Pro presentation).
 * The 16-scenario grid keeps its contrast-validated ramp (computed, not
 * guessed — see globals.css) and its keyboard nav. Inputs for the
 * selected scenario render in a compact definition list; the crash
 * replay compares the identical book under isolated liquidation.
 */

import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Td, Th } from "@/components/ui";
import {
  CRASH_REPLAYS,
  LEGS_FIXTURE,
  demoActions,
  useBreakdown,
  useDemo,
} from "@/lib/demo";
import { fiat, num, pct, ratio } from "@/lib/format";
import {
  GAP_PREMIUM,
  HC_LP,
  HC_R1,
  HC_R2,
  HC_STOCK,
  PERM_LIQ_HC,
  SHOCKS,
  VOL_STATES,
  lossLP,
  lossStock,
} from "@/lib/margin";

export default function StressPage() {
  const bd = useBreakdown();
  const { gateOpen, r1TransferRestricted, debt } = useDemo();
  const [selected, setSelected] = useState(0); // s = i·2 + j
  const [replayRan, setReplayRan] = useState(false);

  const stockUsd = LEGS_FIXTURE.stock.amountUsd;
  const lpUsd = LEGS_FIXTURE.lp.amountUsd;
  const r1Usd = LEGS_FIXTURE.r1.amountUsd;
  const navUsd = LEGS_FIXTURE.r2.amountUsd;

  const sel = bd.scenarios[selected];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stress tests</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Eight price shocks across two volatility states price all three
            collateral classes together. Fee credit halves under negative
            shocks.
          </p>
        </div>
        <Badge tone="neutral">
          worst-case IM {fiat(bd.im, "detailed")}
        </Badge>
      </div>

      <Card
        title="Scenario grid"
        caption="initial margin loss per cell · select a cell, or use arrow keys"
        action={
          <Badge tone="destructive" title={`at sh ${pct(bd.worstScenario.sh * 100, { decimals: 0 })} vol ×${num(bd.worstScenario.vol, 1)}`}>
            worst {fiat(bd.im)}
          </Badge>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-1">
            <caption className="sr-only">
              16-scenario stress grid; rows are volatility states, columns are
              price shocks; each cell shows the initial margin loss
            </caption>
            <thead>
              <tr>
                <Th>vol ↓ · shock →</Th>
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
                  <Td>×{num(vol, 1)}</Td>
                  {SHOCKS.map((_, i) => {
                    const s = i * 2 + j;
                    const cell = bd.scenarios[s];
                    if (!cell) return null;
                    const intensity =
                      bd.im > 0 ? Math.min(1, cell.lossIM / bd.im) : 0;
                    const worst = s === bd.worstScenario.s;
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
                            if (e.key === "ArrowRight") {
                              setSelected(Math.min(7, i + 1) * 2 + j);
                              e.preventDefault();
                            } else if (e.key === "ArrowLeft") {
                              setSelected(Math.max(0, i - 1) * 2 + j);
                              e.preventDefault();
                            } else if (e.key === "ArrowDown") {
                              setSelected(i * 2 + Math.min(1, j + 1));
                              e.preventDefault();
                            } else if (e.key === "ArrowUp") {
                              setSelected(i * 2 + Math.max(0, j - 1));
                              e.preventDefault();
                            }
                          }}
                          aria-label={`Scenario ${s}: shock ${pct(cell.sh * 100, { decimals: 0 })} at ×${num(vol, 1)} vol — loss ${fiat(cell.lossIM)}`}
                          aria-pressed={selected === s}
                          title={`sh ${pct(cell.sh * 100, { decimals: 0 })} · loss ${fiat(cell.lossIM)}`}
                          className={`w-full min-h-9 rounded-md px-2 py-2 text-right font-mono text-xs tabular-nums transition-shadow duration-150 motion-reduce:transition-none outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:outline-1 ${
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
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card
          title="Selected scenario"
          caption="every term visible — computed, not quoted from a slide"
          action={
            <Badge tone="neutral">
              s = {sel.i}·2 + {sel.j}
            </Badge>
          }
        >
          {sel ? (
            <dl className="flex flex-col">
              {[
                {
                  term: "scaled shock",
                  value: pct(sel.sh * 100, { decimals: 1 }),
                  note: `sh = ${pct(SHOCKS[sel.i] * 100, { decimals: 0 })} × vol ${num(volState(sel.j), 1)}`,
                },
                {
                  term: "lossStock",
                  value: fiat(sel.lossStock, "detailed"),
                  note: "max(0, −sh) · stockLegUsd",
                },
                {
                  term: "lossLP",
                  value: fiat(sel.lossLP, "detailed"),
                  note: `lpLegUsd · (${num(0.8 * Math.abs(sel.sh) + 0.05 * sel.sh * sel.sh, 4)}) beta × |sh| + convexity × sh²`,
                },
                {
                  term: "lossR1 × vol",
                  value: fiat(sel.lossR1 * sel.vol, "detailed"),
                  note: `equity · 0.20 · (1 + ${num(GAP_PREMIUM, 1)} gap premium)`,
                },
                {
                  term: "lossR2",
                  value: fiat(sel.lossR2, "detailed"),
                  note: `${pct(PERM_LIQ_HC * 100, { decimals: 1 })} perm-liq haircut + exit cost`,
                },
                {
                  term: "fee credit",
                  value: `−${fiat(sel.feeCreditApplied, "detailed")}`,
                  note: "halved under negative shocks (§4.3)",
                },
                {
                  term: "IM",
                  value: fiat(sel.lossIM, "detailed"),
                  note: "the grid's initial margin requirement for this cell",
                },
              ].map((row, idx, rows) => (
                <div
                  key={row.term}
                  className={`flex items-baseline justify-between gap-4 py-2.5 ${
                    idx < rows.length - 1 ? "border-b border-border/50" : ""
                  } ${row.term === "IM" ? "items-baseline" : ""}`}
                >
                  <dt className="min-w-0">
                    <span
                      className={`block text-[13px] ${row.term === "IM" ? "font-semibold" : ""}`}
                    >
                      {row.term}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.note}
                    </span>
                  </dt>
                  <dd
                    className={`shrink-0 font-mono tabular-nums text-[13px] ${
                      row.term === "IM" ? "text-base font-semibold" : ""
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Card>

        <div className="flex flex-col gap-5">
          <Card
            title="Crash replay"
            caption="identical book · isolated liquidation vs cross-margin (F12)"
            action={
              <Button
                size="sm"
                tone={replayRan ? "secondary" : "primary"}
                onClick={() => setReplayRan(true)}
              >
                {replayRan ? (
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                ) : (
                  <Play className="size-3.5" aria-hidden="true" />
                )}
                {replayRan ? "Rerun" : "Run replay"}
              </Button>
            }
          >
            {!replayRan ? (
              <p className="text-[13px] leading-6 text-muted-foreground">
                Runs three historical crash paths (disclosed fixture replay
                inputs) against this account&apos;s live grid state, and shows
                what the same collateral would look like under isolated,
                per-class liquidation.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {CRASH_REPLAYS.map((crash) => {
                  const sh = crash.peakShock * crash.vol;
                  const abs = Math.abs(sh);
                  const lossStockV = lossStock(sh, stockUsd);
                  const lossLPV = lossLP(sh, lpUsd);
                  const r1Term = r1Usd * abs * (1 + GAP_PREMIUM) * crash.vol;
                  const r2Term =
                    navUsd * PERM_LIQ_HC +
                    Math.min(navUsd * 0.005, LEGS_FIXTURE.r2.dailyCouponUsd * 2);
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

                  const total = stockUsd + lpUsd + r1Usd + navUsd;
                  const classes = [
                    { name: "equity", c: stockUsd * HC_STOCK - lossStockV, share: (debt * stockUsd) / total },
                    { name: "LP", c: lpUsd * HC_LP - lossLPV, share: (debt * lpUsd) / total },
                    { name: "R1", c: r1Usd * HC_R1 - r1Term, share: (debt * r1Usd) / total },
                    { name: "R2", c: navUsd * HC_R2 - r2Term, share: (debt * navUsd) / total },
                  ];
                  const failing = classes.filter((c) => c.c < c.share);
                  const shortfall = failing.reduce((a, c) => a + (c.share - c.c), 0);

                  return (
                    <li
                      key={crash.id}
                      className="rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-medium">{crash.label}</p>
                        <Badge tone="neutral">
                          sh {pct(sh * 100, { decimals: 1 })} · ×{num(crash.vol, 1)} vol
                        </Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <dt className="text-muted-foreground">cross-margin IM</dt>
                        <dd className="text-right font-mono tabular-nums">
                          {fiat(im, "detailed")}
                        </dd>
                        <dt className="text-muted-foreground">health after</dt>
                        <dd className="text-right font-mono tabular-nums">{healthAfter}</dd>
                        <dt className="text-muted-foreground">isolated fails</dt>
                        <dd className="text-right font-mono tabular-nums">
                          {failing.length > 0
                            ? failing.map((c) => c.name).join(", ")
                            : "none"}
                        </dd>
                        {failing.length > 0 ? (
                          <>
                            <dt className="text-muted-foreground">
                              isolated shortfall
                            </dt>
                            <dd className="text-right font-mono tabular-nums text-destructive">
                              {fiat(shortfall, "detailed")}
                            </dd>
                          </>
                        ) : null}
                      </dl>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {failing.length > 0
                          ? `Isolated: the ${failing.map((c) => c.name).join(" + ")} class is liquidated against its pro-rata debt. Cross-margined: no unwind at health ${healthAfter} — the zero-bad-debt path.`
                          : `Both structures clear this one; inputs: peak shock ${pct(crash.peakShock * 100, { decimals: 1 })}, vol ×${num(crash.vol, 1)} (fixture replay path).`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Current flags"
            caption="what the engine sees right now"
          >
            <div className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  R1 transfer-restricted
                </span>
                <Badge tone={r1TransferRestricted ? "warning" : "positive"}>
                  {r1TransferRestricted ? "true — locked" : "false"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">R2 redemption gate</span>
                <Badge tone={gateOpen ? "positive" : "warning"}>
                  {gateOpen ? "open" : "shut"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">unwindable now</span>
                <span className="font-mono text-[13px] tabular-nums">
                  {fiat(bd.unwindableNow, "detailed")}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button tone="destructive" size="sm" onClick={() => demoActions.gateShut()} disabled={!gateOpen}>
                Shut the gate
              </Button>
              <Button size="sm" onClick={() => demoActions.gateOpen()} disabled={gateOpen}>
                Reopen the gate
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function volState(j: number): number {
  return VOL_STATES[j];
}
