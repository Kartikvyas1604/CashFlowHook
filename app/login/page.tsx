"use client";

/**
 * Sign in — the only route outside the app chrome.
 * Auth runs on Privy (login and signup are one flow: email verification
 * or a wallet connect; Privy provisions the embedded wallet). When no
 * Privy app id is configured the page falls back to the disclosed demo
 * sign-in, so the app is never broken by a missing key.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Waypoints } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { PRIVY_ENABLED, PrivyLogin } from "@/components/privy";
import { sessionActions, useSession } from "@/lib/session";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* brand row */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card">
            <Waypoints className="size-5 text-primary" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Sign in to CashflowHook
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              The credit line for an AI agent, cosigned by a verified human.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {PRIVY_ENABLED ? (
            <PrivyLogin />
          ) : (
            <DemoFallbackLogin />
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-4 py-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {PRIVY_ENABLED
              ? "Authentication is handled by Privy. Your credentials go to Privy only; the app receives a verified session."
              : "Demo environment — Privy app id not configured, so the disclosed fallback sign-in is active. No real accounts exist and nothing leaves your browser."}
          </p>
          <span className="flex items-center gap-1.5 text-[11px] text-primary">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Non-custodial · Aqua virtual balance
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* fallback (no Privy app id configured)                               */
/* ------------------------------------------------------------------ */

function DemoFallbackLogin() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = sessionActions.signIn(email, password);
    setEmailError(result.emailError);
    setPasswordError(result.passwordError);
    if (!result.emailError && !result.passwordError) {
      router.replace("/onboard");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={emailError}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@fund.com"
          value={email}
          invalid={emailError != null}
          aria-invalid={emailError != null}
          aria-describedby={emailError ? "email-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          disabled={status === "validating"}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={passwordError}
        hint="At least 8 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          invalid={passwordError != null}
          aria-invalid={passwordError != null}
          aria-describedby={passwordError ? "password-error" : undefined}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError(null);
          }}
          disabled={status === "validating"}
        />
      </Field>

      <Button type="submit" tone="primary" size="lg" disabled={status === "validating"}>
        {status === "validating" ? (
          <>
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
