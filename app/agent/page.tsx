"use client";

/**
 * Agent runs (§6.8 screen 4, Quiet Pro presentation).
 * One column: the policy log. The rail: the World step-up flow with its
 * required denied path (F10), autonomy controls through the engine's
 * own validation path, and the x402 receipt.
 */

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Td, Th } from "@/components/ui";
import {
  FEED,
  LEGS_FIXTURE,
  demoActions,
  effectiveCaps,
  useBreakdown,
  useDemo,
} from "@/lib/demo";
import { fiat, pct, utcClock } from "@/lib/format";
import { PASSWORD_MIN, validatePassword } from "@/lib/session";

const FEE_CAP = 0.10;

const KIND_TONE: Record<string, string> = {
  draw: "primary",
  repay: "neutral",
  gate: "warning",
  deny: "destructive",
  grant: "positive",
  cap: "warning",
  accept: "positive",
};

const KIND_LABEL: Record<string, string> = {
  draw: "draw",
  repay: "repay",
  gate: "gate",
  deny: "denied",
  grant: "granted",
  cap: "cap",
  accept: "accepted",
};

/** draw amount input — validated against the per-draw cap before submit */
function parseDrawAmount(raw: string, perDrawCap: number): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.replace(/[$,\s]/g, "");
  if (!trimmed) return { ok: false, error: "Enter an amount in USDC" };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0)
    return { ok: false, error: "That isn't a usable USDC amount" };
  if (value > perDrawCap)
    return {
      ok: false,
      error: `Above the per-draw cap of ${fiat(perDrawCap, "detailed")}`,
    };
  return { ok: true, value: Math.floor(value * 100) / 100 };
}

export default function AgentPage() {
  const demo = useDemo();
  const { debt, draws, receipts, policy, stepUp, lockedRiskAcceptedUntil } = demo;
  const bd = useBreakdown();
  const caps = effectiveCaps(demo, bd);

  const [drawRaw, setDrawRaw] = useState("");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [repayRaw, setRepayRaw] = useState("");
  const [repayError, setRepayError] = useState<string | null>(null);

  const drawsUsed = draws.filter((d) => FEED.now - d.ts <= 12 * 3600).length;
  const x402 = receipts.filter((r) => r.rail === "x402" && !r.reverted);

  function submitDraw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = parseDrawAmount(drawRaw, caps.perDrawCap);
    if (!parsed.ok) {
      setDrawError(parsed.error);
      return;
    }
    setDrawError(null);
    demoActions.draw(parsed.value);
    setDrawRaw("");
  }

  function submitRepay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = repayRaw.replace(/[$,\s]/g, "");
    if (!trimmed) {
      setRepayError("Enter an amount in USDC");
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      setRepayError("That isn't a usable USDC amount");
      return;
    }
    if (value > debt) {
      setRepayError(`Debt is only ${fiat(debt, "detailed")}`);
      return;
    }
    setRepayError(null);
    demoActions.repay(value);
    setRepayRaw("");
  }

  // the step-up "human approval" is gated by a strength check input
  // (demonstrating validation on a protected action)
  const [confirmRaw, setConfirmRaw] = useState("");
  const confirmOk = validatePassword(confirmRaw) === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent runs</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The agent draws within hard caps and pays exactly one external bill
            via x402, with a receipt for every spend.
          </p>
        </div>
        <Badge tone={caps.elevated ? "positive" : "neutral"}>
          {caps.elevated ? "elevated tier · 24 h" : "standard tier"}
        </Badge>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-5">
        {/* policy log */}
        <Card
          title="Policy log"
          caption="append-only · newest first (I8)"
          className="lg:col-span-3"
          action={<Badge tone="neutral">{policy.length} entries</Badge>}
        >
          {policy.length === 0 ? (
            <Empty title="No entries yet" hint="Agent decisions appear here as they happen." />
          ) : (
            <ol className="flex max-h-[460px] flex-col">
              {policy.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <Badge tone={KIND_TONE[e.kind] ?? "neutral"}>
                        {KIND_LABEL[e.kind] ?? e.kind}
                      </Badge>
                      <span className="truncate text-[13px] font-medium">
                        {e.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {e.detail}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {utcClock(e.ts)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* rail */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card
            title="Draw and repay"
            caption={`window: ${drawsUsed}/${caps.drawsPerWindow} draws · resets after the 12 h window`}
          >
            <form onSubmit={submitDraw} className="flex flex-col gap-2" noValidate>
              <Field
                label="Agent draw (USDC)"
                htmlFor="draw-amount"
                error={drawError}
                hint={`Cap is ${fiat(caps.perDrawCap, "detailed")} per draw; total debt may never exceed borrowing power (I2).`}
              >
                <Input
                  id="draw-amount"
                  inputMode="decimal"
                  placeholder="1,500"
                  value={drawRaw}
                  invalid={drawError != null}
                  aria-invalid={drawError != null}
                  onChange={(e) => {
                    setDrawRaw(e.target.value);
                    if (drawError) setDrawError(null);
                  }}
                />
              </Field>
              <Button type="submit" tone="primary" disabled={drawRaw.length === 0}>
                Draw
              </Button>
            </form>

            <form
              onSubmit={submitRepay}
              className="mt-5 flex flex-col gap-2 border-t border-border pt-4"
              noValidate
            >
              <Field
                label="Repay (USDC)"
                htmlFor="repay-amount"
                error={repayError}
                hint={`Outstanding debt ${fiat(debt, "detailed")}.`}
              >
                <Input
                  id="repay-amount"
                  inputMode="decimal"
                  placeholder="2,000"
                  value={repayRaw}
                  invalid={repayError != null}
                  aria-invalid={repayError != null}
                  onChange={(e) => {
                    setRepayRaw(e.target.value);
                    if (repayError) setRepayError(null);
                  }}
                />
              </Field>
              <Button type="submit" disabled={repayRaw.length === 0}>
                Repay
              </Button>
            </form>
          </Card>

          <Card
            title="Human step-up"
            caption="World ID Agent Pass · validated server-side (I7)"
            action={
              stepUp === "granted" ? (
                <Badge tone="positive">accepted</Badge>
              ) : stepUp === "denied" ? (
                <Badge tone="destructive">denied</Badge>
              ) : (
                <Badge tone="neutral">no request</Badge>
              )
            }
          >
            <p className="text-[13px] leading-6 text-muted-foreground">
              Raising caps or unwinding past liquidatable backing needs a
              verified human. The first request runs the <strong>denied
              path</strong> (expired proof — no raise, protected action does
              not occur); the second runs the accepted path with a mocked
              proof payload.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {stepUp !== "granted" ? (
                <Button
                  tone={stepUp === "denied" ? "primary" : "secondary"}
                  onClick={() => demoActions.requestStepUp()}
                >
                  {stepUp === "denied"
                    ? "Request again — accepted-proof path"
                    : "Request step-up"}
                </Button>
              ) : null}

              {stepUp === "granted" ? (
                <div className="rounded-lg border border-positive/40 bg-positive/10 px-3 py-2.5 text-[13px]">
                  Elevated tier is live for{" "}
                  {lockedRiskAcceptedUntil != null
                    ? "the next 24 h"
                    : "the agreed window"}
                  . Draws up to {fiat(caps.perDrawCap, "detailed")} per draw and{" "}
                  {caps.drawsPerWindow} per 12 h window.
                </div>
              ) : null}

              {stepUp === "granted" || stepUp === "denied" ? null : (
                <Field
                  label="Confirm with a passphrase (demo)"
                  htmlFor="confirm-pass"
                  hint={`At least ${PASSWORD_MIN} characters — this validates the human-confirmation step without a live World proof.`}
                >
                  <Input
                    id="confirm-pass"
                    type="password"
                    autoComplete="off"
                    value={confirmRaw}
                    onChange={(e) => setConfirmRaw(e.target.value)}
                    aria-invalid={!confirmOk}
                    disabled={stepUp !== "idle"}
                  />
                </Field>
              )}
            </div>
          </Card>

          <Card
            title="x402 bill"
            caption="one bill, one receipt (I8)"
            action={<Badge tone="primary">x402</Badge>}
          >
            {x402.length === 0 ? (
              <Empty title="No bill recorded" hint="The agent's bill appears here once paid." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px]">
                  <thead>
                    <tr>
                      <Th>To</Th>
                      <Th>Amount</Th>
                      <Th>At</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {x402.map((r) => (
                      <tr key={r.id}>
                        <Td>
                          <span className="block text-[13px]">data feed provider</span>
                          <span className="block text-xs text-muted-foreground">
                            self-hosted endpoint (demo)
                          </span>
                        </Td>
                        <Td numeric>{fiat(r.amountUsd ?? 0, "detailed")}</Td>
                        <Td mono>{utcClock(r.ts)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                  spend mirrored to the receipts registry · capped at{" "}
                  {pct(FEE_CAP, { decimals: 0 })} of collateral shared with fee credit
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
