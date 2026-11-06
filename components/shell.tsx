"use client";

/**
 * App shell — Quiet Pro.
 * Sidebar navigation (desktop) with a slim top bar on phones, a session
 * gate that sends signed-out visitors to /login, and the beat toast
 * parked bottom-right. /login renders outside the chrome (own layout).
 */

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  LogOut,
  SquareUser,
  Waypoints,
  X,
} from "lucide-react";
import { SidebarLink, FOCUS } from "@/components/ui";
import { sessionActions, useSession } from "@/lib/session";
import { PRIVY_ENABLED } from "@/components/privy";
import { demoActions, useDemo, useBreakdown } from "@/lib/demo";
import { fiat, ratio } from "@/lib/format";

const NAV = [
  { href: "/", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  { href: "/positions", label: "Positions", icon: <ListChecks className="size-4" /> },
  { href: "/stress", label: "Stress tests", icon: <FlaskConical className="size-4" /> },
  { href: "/agent", label: "Agent runs", icon: <Waypoints className="size-4" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { beat } = useDemo();

  const isLogin = pathname === "/login";
  const authed = session.status === "signed-in";

  // with Privy enabled, wait for its initial auth decision before the
  // gate routes anywhere (the bridge commits signed-in or stays silent)
  const gateReady =
    !PRIVY_ENABLED || session.status !== "signed-out";

  // session gate — hooks run on EVERY render, before any early return
  // (rules of hooks: the count and order must never change per route)
  useEffect(() => {
    if (isLogin || authed || !gateReady) return;
    router.replace("/login");
  }, [isLogin, authed, gateReady, router]);

  if (isLogin) return <>{children}</>;

  if (!authed) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {gateReady ? "Taking you to sign in…" : "Checking your session…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      {/* sidebar (≥lg) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-md ${FOCUS}`}
          >
            <Waypoints className="size-5 text-primary" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-4 tracking-tight">
                CashflowHook
              </span>
              <span className="text-[11px] text-muted-foreground">
                credit line studio
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="product" className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((t) => (
            <SidebarLink
              key={t.href}
              href={t.href}
              active={pathname === t.href}
              icon={t.icon}
            >
              {t.label}
            </SidebarLink>
          ))}
          <div className="my-3 border-t border-border" aria-hidden="true" />
          <SidebarLink
            href="/onboard"
            active={pathname === "/onboard"}
            icon={<SquareUser className="size-4" />}
          >
            Setup
          </SidebarLink>
        </nav>

        <div className="flex flex-col gap-2.5 border-t border-border px-4 py-4">
          {/* persistent non-custodial badge (§6.8 copy rule) */}
          <span className="flex items-center gap-1.5 text-[11px] leading-4 text-primary">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Non-custodial · Aqua virtual balance
          </span>
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate text-xs text-muted-foreground"
              title={session.email ?? "Privy wallet session"}
            >
              {session.email ?? "Privy wallet"}
            </span>
            <button
              type="button"
              onClick={() => sessionActions.signOut()}
              aria-label="Sign out"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground ${FOCUS}`}
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile header (<lg) */}
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <Link href="/" className={`flex items-center gap-2 ${FOCUS}`}>
            <Waypoints className="size-4 text-primary" aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-tight">
              CashflowHook
            </span>
          </Link>
          <nav aria-label="product" className="ml-auto flex items-center gap-1">
            {NAV.map((t) => (
              <SidebarLink key={t.href} href={t.href} active={pathname === t.href} icon={t.icon}>
                <span className="sr-only sm:not-sr-only">{t.label}</span>
              </SidebarLink>
            ))}
          </nav>
        </header>

        <SessionNote email={session.email} />

        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>

        <footer className="px-6 pb-6">
          <p className="mx-auto max-w-[1120px] text-[11px] text-muted-foreground">
            Demo fixtures, disclosed. Local Anvil fork of Base mainnet · OUSG/USDY
            NAV read from Ethereum mainnet (view calls only) · no live chain calls.
          </p>
        </footer>
      </div>

      {/* beat toast — bottom right, functional entrance */}
      {beat ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-md"
        >
          <div
            className={`beat-toast flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${
              beat.tone === "destructive"
                ? "border-destructive/50 bg-destructive/10"
                : beat.tone === "warning"
                  ? "border-warning/50 bg-warning/10"
                  : beat.tone === "positive"
                    ? "border-positive/50 bg-positive/10"
                    : "border-border bg-card"
            }`}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{beat.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{beat.body}</p>
            </div>
            <button
              type="button"
              onClick={() => demoActions.dismissBeat()}
              aria-label="Dismiss notification"
              className={`shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground ${FOCUS}`}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionNote({ email }: { email: string | null }) {
  const bd = useBreakdown();
  const { debt } = useDemo();
  return (
    <div className="hidden items-center justify-between gap-4 border-b border-border px-6 py-3 lg:flex">
      <p className="text-xs text-muted-foreground">
        signed in as <span className="text-foreground">{email}</span>
      </p>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        health {ratio(bd.health)} · debt {fiat(debt)}
      </p>
    </div>
  );
}
