"use client";

/**
 * Setup (§6.8 screen 1, Quiet Pro presentation).
 * Three steps in one screen: choose the preset, verify the human pass,
 * grant the unwinder. Every step validates before the next unlocks:
 * preset required, a passphrase-strength confirmation for the
 * verification key, and the mechanics checkbox for the grant.
 */

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BadgeCheck, Fingerprint, ShieldCheck, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CheckRow,
  Field,
  FOCUS,
  Input,
} from "@/components/ui";
import { demoActions, effectiveCaps, useBreakdown, useDemo } from "@/lib/demo";
import { fiat, ratio } from "@/lib/format";
import { MAINT } from "@/lib/margin";
import { PASSWORD_MIN, validatePassword } from "@/lib/session";

const PRESETS = [
  {
    id: "operator",
    label: "Demo operator account",
    detail:
      "equity + v4 LP + restricted RWA + treasury NAV · debt $74,000 USDC · health 1.28x at rest",
  },
  {
    id: "fixture-a",
    label: "Labelled fixture · strategy A",
    detail: "Bureau seeded preset — mixed classes, smaller debt. No live chain calls.",
  },
  {
    id: "fixture-b",
    label: "Labelled fixture · strategy B",
    detail: "Bureau seeded preset — equity and LP only. No live chain calls.",
  },
] as const;

export default function OnboardPage() {
  const demo = useDemo();
  const bd = useBreakdown();
  const caps = effectiveCaps(demo, bd);

  const { connected, worldVerified, unwinderGranted, debt } = demo;
  const [preset, setPreset] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [mechanics, setMechanics] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const passOk = validatePassword(passphrase) === null;
  const canVerify = preset != null && passOk && !worldVerified;

  function handleVerify() {
    if (preset == null) {
      setPresetError("Choose an account preset before verifying");
      return;
    }
    const err = validatePassword(passphrase);
    if (err) {
      setPassError(err);
      return;
    }
    setPassError(null);
    if (!connected) demoActions.connectWallet();
    demoActions.verifyWorld();
  }

  function handleGrant() {
    if (!worldVerified) return;
    if (!mechanics) {
      setGrantError("Confirm the mechanics before granting");
      return;
    }
    setGrantError(null);
    demoActions.grantUnwinder();
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Setup</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            One screen, three checks: preset, human verification, unwinder
            grant. Fixtures are labelled as fixtures — nothing pretends to be
            live.
          </p>
        </div>
        {unwinderGranted ? (
          <Badge tone="positive">
            <BadgeCheck className="size-3" aria-hidden="true" />
            setup complete
          </Badge>
        ) : (
          <Badge tone="neutral">{connected ? "step 2 of 3" : "step 1 of 3"}</Badge>
        )}
      </div>

      {/* step 1 — preset */}
      <Card title="Step 1 · Connect and choose a preset" caption="the demo wallet holds the legs; the protocol never does (I1)">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Account preset</legend>
          {PRESETS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors duration-150 ${FOCUS} ${
                preset === p.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-secondary/40"
              } motion-reduce:transition-none`}
            >
              <input
                type="radio"
                name="preset"
                value={p.id}
                checked={preset === p.id}
                onChange={() => {
                  setPreset(p.id);
                  setPresetError(null);
                  if (!connected) demoActions.connectWallet();
                }}
                className="mt-1 accent-[var(--primary)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{p.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {p.detail}
                </span>
              </span>
            </label>
          ))}
          {presetError ? (
            <p role="alert" className="text-xs text-destructive">
              {presetError}
            </p>
          ) : null}
        </fieldset>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {connected
              ? "demo wallet connected (fixture account)"
              : "the demo wallet connects when you pick a preset"}
          </p>
          <Wallet
            className={`size-4 ${connected ? "text-positive" : "text-muted-foreground"}`}
            aria-hidden="true"
          />
        </div>
      </Card>

      {/* step 2 — verify */}
      <Card
        title="Step 2 · Verify the human pass"
        caption="Agent Pass validated server-side (I7) — proofs are mocked in the demo"
        action={worldVerified ? <Badge tone="positive">verified</Badge> : undefined}
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Confirmation passphrase"
            htmlFor="verify-pass"
            error={passError}
            hint={`At least ${PASSWORD_MIN} characters — this validates the confirmation step without a live World proof.`}
          >
            <Input
              id="verify-pass"
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              value={passphrase}
              invalid={passError != null}
              aria-invalid={passError != null}
              aria-describedby={passError ? "verify-pass-error" : undefined}
              onChange={(e) => {
                setPassphrase(e.target.value);
                if (passError) setPassError(null);
              }}
            />
          </Field>
          <Button
            tone="primary"
            onClick={handleVerify}
            disabled={worldVerified}
            title={canVerify ? undefined : "Pick a preset and enter a valid passphrase first"}
          >
            <Fingerprint className="size-4" aria-hidden="true" />
            Verify with the Agent Pass
          </Button>
        </div>
      </Card>

      {/* step 3 — grant */}
      <Card
        title="Step 3 · Grant the unwinder"
        caption="one registered operator — the only path that can unwind the account"
        action={unwinderGranted ? <Badge tone="positive">granted</Badge> : undefined}
      >
        <div className="flex flex-col gap-3">
          <CheckRow checked={mechanics} onChange={setMechanics}>
            I understand the unwinder nets the liquidatable legs atomically, and
            locked assets never back an unwind unless a verified human accepts
            that risk.
          </CheckRow>
          {grantError ? (
            <p role="alert" className="text-xs text-destructive">
              {grantError}
            </p>
          ) : null}
          <Button tone="primary" onClick={handleGrant} disabled={worldVerified ? !mechanics || unwinderGranted : true}>
            Grant the unwinder
          </Button>
        </div>
      </Card>

      {/* caps summary */}
      <Card
        title="Granted caps"
        caption="what this account may draw — §4.2 defaults, computed from the preset"
        action={<Badge tone="primary">health {ratio(bd.health)}</Badge>}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">per-draw cap</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{fiat(caps.perDrawCap, "detailed")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">draws / 12 h</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{caps.drawsPerWindow}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">maintenance</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{ratio(MAINT)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">borrowing power</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{fiat(bd.bp, "detailed")}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonLink href="/" tone="primary">
            Open the dashboard
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </ButtonLink>
          <Link
            href="/agent"
            className={`text-xs font-medium text-primary outline-offset-2 outline-0 outline-ring focus-visible:outline-2 hover:underline underline-offset-2 motion-reduce:transition-none ${FOCUS}`}
          >
            or go straight to agent runs
          </Link>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            preset debt {fiat(debt, "detailed")}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          drawn liquidity stays an Aqua virtual balance — your assets never move
          to the protocol.
        </p>
      </Card>
    </div>
  );
}
