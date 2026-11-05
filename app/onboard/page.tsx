"use client";

/**
 * Onboard (§6.8 screen 1): connect wallet → select the demo preset →
 * World sign-in → grant Unwinder → show the granted caps. One screen,
 * sequential enablement — every prerequisite has helper text.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Fingerprint,
  Wallet,
} from "lucide-react";
import { Badge, Button, Panel, RING } from "@/components/ui";
import { demoActions, useBreakdown, useDemo } from "@/lib/demo";
import { fiat, pct, ratio } from "@/lib/format";
import { AUTONOMY_CAP_PCT, AUTONOMY_MAX_DRAWS, MAINT } from "@/lib/margin";

const PRESETS = [
  {
    id: "operator",
    label: "Demo operator account",
    detail:
      "tokenized equity 62,000 + v4 LP 38,500 + RWA equity 12,800 + treasury NAV 46,200 · debt 74,000 USDC",
  },
  {
    id: "fixture-a",
    label: "fixture · strategy A (labelled fixture)",
    detail:
      "bureau demo preset — mixed classes, smaller debt; no live chain calls",
  },
  {
    id: "fixture-b",
    label: "fixture · strategy B (labelled fixture)",
    detail:
      "bureau demo preset — equity + LP strategy only; no live chain calls",
  },
] as const;

export default function OnboardPage() {
  const { connected, worldVerified, unwinderGranted, debt } = useDemo();
  const bd = useBreakdown();
  const [preset, setPreset] = useState<string | null>(null);
  const [acceptedMechanics, setAcceptedMechanics] = useState(false);

  const canVerify = connected && preset != null;
  const canGrant = canVerify && worldVerified;
  const complete = canGrant && unwinderGranted && acceptedMechanics;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboard</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          one screen: connect, preset, verify, grant — the demo account uses
          fixture data and performs no live chain calls
        </p>
      </div>

      {/* step 1 — connect */}
      <Panel
        title="1 · Connect a wallet"
        caption="a wallet holds the legs; the protocol never does (I1)"
        right={connected ? <Badge tone="positive">connected</Badge> : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px]">Demo wallet · fixture account</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              The demo runs against a local Anvil fork of Base mainnet — no
              custody transfers, borrowed liquidity stays an Aqua virtual
              balance.
            </p>
          </div>
          <Button tone="primary" onClick={() => demoActions.connectWallet()} disabled={connected}>
            <Wallet className="size-3.5" aria-hidden="true" />
            {connected ? "Connected" : "Connect"}
          </Button>
        </div>
      </Panel>

      {/* step 2 — preset */}
      <Panel
        title="2 · Select the account preset"
        caption="fixtures are labelled as fixtures (BR6) — nothing pretends to be live"
        right={preset ? <Badge tone="positive">selected</Badge> : undefined}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Account preset</legend>
          {PRESETS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-150 ${RING} ${
                preset === p.id
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-secondary/30 hover:bg-secondary/50"
              } motion-reduce:transition-none`}
            >
              <input
                type="radio"
                name="preset"
                value={p.id}
                checked={preset === p.id}
                onChange={() => setPreset(p.id)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{p.label}</span>
                <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground">
                  {p.detail}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {!connected && preset == null ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            select a preset after connecting — verification verifies the
            account owner
          </p>
        ) : null}
      </Panel>

      {/* step 3 — world */}
      <Panel
        title="3 · Verify with the World Agent Pass"
        caption="required for autonomy step-ups; validated server-side (I7)"
        right={
          worldVerified ? <Badge tone="positive">verified</Badge> : undefined
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px]">Proof of humanity for the raise-cap paths</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Proofs are mocked in the World portal demo app — the demo never
              treats a client-asserted result as authorization.
            </p>
          </div>
          <Button
            tone="primary"
            onClick={() => demoActions.verifyWorld()}
            disabled={!canVerify || worldVerified}
            title={!canVerify ? "Connect a wallet and select a preset first" : undefined}
          >
            <Fingerprint className="size-3.5" aria-hidden="true" />
            {worldVerified ? "Verified" : "Verify"}
          </Button>
        </div>
        {canVerify ? null : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {connected
              ? "select a preset to continue — verification proves the account owner"
              : "connect a wallet, then select a preset"}
          </p>
        )}
      </Panel>

      {/* step 4 — unwinder */}
      <Panel
        title="4 · Grant the Unwinder"
        caption="one approved operator — the only path that can unwind the account"
        right={
          unwinderGranted ? <Badge tone="positive">granted</Badge> : undefined
        }
      >
        <label className="flex items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            checked={acceptedMechanics}
            onChange={(e) => setAcceptedMechanics(e.target.checked)}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>
            I understand the Unwinder nets the liquidatable legs atomically in
            one transaction, and locked legs (&ldquo;earning but
            locked&rdquo;) never back an unwind unless a human accepts that
            risk.
          </span>
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {!canGrant
              ? "verify first — the grant follows verification"
              : acceptedMechanics
                ? "grant registers the unwinder on the account"
                : "confirm the mechanics above to enable the grant"}
          </p>
          <Button
            tone="primary"
            onClick={() => demoActions.grantUnwinder()}
            disabled={!canGrant || unwinderGranted || !acceptedMechanics}
          >
            <CircleDollarSign className="size-3.5" aria-hidden="true" />
            {unwinderGranted ? "Granted" : "Grant"}
          </Button>
        </div>
      </Panel>

      {/* granted caps */}
      <Panel
        title={`Granted caps${complete ? "" : " · partial (preview — computed from fixture inputs)"}`}
        caption="what this account may draw, per §4.2 defaults"
        right={<Badge tone="primary">health {ratio(bd.health)}</Badge>}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] tabular-nums md:grid-cols-4">
          <div>
            <p className="text-[11px] text-muted-foreground">per-draw cap</p>
            <p>{fiat(bd.perDrawCap, "detailed")}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">draws / 12 h</p>
            <p>{AUTONOMY_MAX_DRAWS}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">maintenance</p>
            <p>{ratio(MAINT)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">borrowing power</p>
            <p>{fiat(bd.bp, "detailed")}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          autonomy caps are {pct(AUTONOMY_CAP_PCT * 100, { decimals: 0 })} of BP
          per draw · raising either cap requires an accepted Agent Pass · debt
          may never exceed BP (I2)
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors duration-150 outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:bg-primary/90 motion-reduce:transition-none`}
          >
            Open the credit desk
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/agent"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-[13px] font-medium text-secondary-foreground transition-colors duration-150 outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:bg-secondary/80 motion-reduce:transition-none"
          >
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Configure the agent
          </Link>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            preset debt {fiat(debt, "detailed")}
          </span>
        </div>
      </Panel>
    </div>
  );
}
