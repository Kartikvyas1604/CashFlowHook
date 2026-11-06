"use client";

/**
 * Privy adapter — every Privy SDK touch lives in this single file
 * (§0.3 adapter rule: a wrong external-name guess breaks exactly one
 * file). API surface verified against @privy-io/react-auth@3.51.3
 * d.ts: PrivyProvider{appId, clientId?, config}, usePrivy(): {ready,
 * authenticated, user.email?.address, logout, login}, loginMethodsAndOrder
 * {primary}, appearance{theme, accentColor}, embeddedWallets.ethereum.
 * {createOnLogin}.
 *
 * When no app id is configured, this file renders a passthrough and the
 * app keeps its disclosed demo sign-in fallback.
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui";
import { sessionActions, useSession } from "@/lib/session";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#5f7cff", // dark-mode primary per brand.md
          landingHeader: "Log in or sign up",
          showWalletLoginFirst: false,
        },
        loginMethodsAndOrder: { primary: ["email", "metamask", "coinbase_wallet", "wallet_connect"] },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PrivySessionBridge>{children}</PrivySessionBridge>
    </PrivyProvider>
  );
}

/**
 * Mirrors Privy's auth state into the session store. Also completes
 * sign-out: the store only FLAGS pendingSignOut; the real logout() runs
 * here because only the bridge may call the SDK.
 */
function PrivySessionBridge({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const session = useSession();
  const email = privy.user?.email?.address ?? null;

  useEffect(() => {
    if (!privy.ready) return;
    if (session.pendingSignOut && session.provider === "privy") {
      void privy.logout(); // authenticated flips false → inactive clears it
      return;
    }
    if (privy.authenticated) {
      sessionActions.privySignIn(email);
    } else {
      sessionActions.privySessionInactive();
    }
  }, [privy.ready, privy.authenticated, email, session.pendingSignOut]);

  return <>{children}</>;
}

/**
 * The Privy login card — shown by /login ONLY when an app id exists.
 * login() and signup are the same Privy flow; an email that isn't a
 * user yet is provisioned on first verification.
 */
export function PrivyLogin() {
  const privy = usePrivy();
  const session = useSession();
  const router = useRouter();
  const signedIn = session.status === "signed-in";

  useEffect(() => {
    if (signedIn) router.replace("/onboard");
  }, [signedIn, router]);

  return (
    <>
      <Button
        tone="primary"
        size="lg"
        disabled={!privy.ready || signedIn}
        onClick={() => privy.login()}
      >
        {!privy.ready ? (
          <>
            <Loader2
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
            Connecting…
          </>
        ) : signedIn ? (
          "Signed in"
        ) : (
          "Continue with email or wallet"
        )}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Privy verifies by email (or a wallet connect) and provisions an
        embedded wallet for the account — one flow for login and signup,
        no password to manage.
      </p>
      {privy.error ? (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          {privy.error.message}
        </p>
      ) : null}
    </>
  );
}
