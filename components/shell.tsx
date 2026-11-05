"use client";

/**
 * App chrome — Workstation Dense: single top bar, tab nav, persistent
 * non-custodial badge, fixture status strip, beat toast (auto-dismiss
 * 7s, manual dismiss, reduced-motion honored).
 */

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Wallet, Waypoints, X } from "lucide-react";
import { NavTab } from "@/components/ui";
import { demoActions, useDemo, useBreakdown, FEED, NOW } from "@/lib/demo";
import { fiat, ratio, utcClock, duration } from "@/lib/format";

const TABS = [
  { href: "/", label: "Credit Desk" },
  { href: "/stress", label: "Stress" },
  { href: "/agent", label: "Agent" },
];

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { beat, debt } = useDemo();
  const bd = useBreakdown();

  // auto-dismiss beats after 7s (keyed per beat id)
  useEffect(() => {
    if (!beat) return;
    const t = setTimeout(() => demoActions.dismissBeat(), 7_000);
    return () => clearTimeout(t);
  }, [beat?.id]);

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-[1400px] items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md outline-offset-4 outline-0 outline-ring focus-visible:outline-2 motion-reduce:transition-none"
          >
            <Waypoints className="size-4 text-primary" aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-tight">
              CashflowHook
            </span>
            <span className="text-[11px] text-muted-foreground">
              credit desk
            </span>
          </Link>

          <nav aria-label="product" className="flex items-center gap-1">
            {TABS.map((t) => (
              <NavTab key={t.href} href={t.href} active={pathname === t.href}>
                {t.label}
              </NavTab>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* persistent badge (§6.8 copy rule) */}
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              <ShieldCheck className="size-3" aria-hidden="true" />
              Non-custodial · Aqua virtual balance
            </span>
            <Link
              href="/onboard"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground transition-colors duration-150 hover:bg-secondary/80 outline-offset-2 outline-0 outline-ring focus-visible:outline-2 motion-reduce:transition-none"
            >
              <Wallet className="size-3" aria-hidden="true" />
              demo account · fixture
            </Link>
          </div>
        </div>
      </header>

      {/* beat toast */}
      {beat ? (
        <div
          role="status"
          className="fixed inset-x-0 top-14 z-50 flex justify-center px-4"
        >
          <div
            className={`flex max-w-xl items-start gap-3 rounded-md border px-3 py-2 shadow-lg backdrop-blur ${
              beat.tone === "destructive"
                ? "border-destructive/50 bg-destructive/10 text-foreground"
                : beat.tone === "warning"
                  ? "border-warning/50 bg-warning/10"
                  : beat.tone === "positive"
                    ? "border-positive/50 bg-positive/10"
                    : "border-border bg-card"
            }`}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{beat.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {beat.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => demoActions.dismissBeat()}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground outline-offset-2 outline-0 outline-ring focus-visible:outline-2 motion-reduce:transition-none"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">
        {children}
      </main>

      {/* status strip */}
      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-0.5 px-4 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>
            health {ratio(bd.health)} · debt{" "}
            {fiat(debt)}
            {bd.stressed
              ? " · STRESSED — unwind eligible"
              : " · within maintenance"}
          </span>
          <span>
            ST/LP mark {utcClock(FEED.stockMarkTs)} (1800 s limit) · NAV{" "}
            {utcClock(FEED.navTs)} (26 h limit) · held {duration(NOW - FEED.lastAccrualTs)}
          </span>
          <span>
            fixture feed — local Anvil fork of Base mainnet · OUSG/USDY NAV read
            from Ethereum mainnet (view calls only)
          </span>
          <span className="ml-auto">09:00 UTC · fixture</span>
        </div>
      </footer>
    </div>
  );
}
