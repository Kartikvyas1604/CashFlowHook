/**
 * UI primitives — Workstation Dense credit desk.
 * Flat panels, border-separated, 4px spacing grid, mono numerals,
 * functional motion only (100–150ms colors, reduced-motion honored).
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "next/link";
import { delta, ratio } from "@/lib/format";

export const RING =
  "outline-ring outline-offset-2 outline outline-0 focus-visible:outline-2 motion-reduce:transition-none";

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  caption,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  caption?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-md border border-border bg-card ${className}`}
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </h2>
          {caption ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              {caption}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className={`px-4 py-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const BADGE_TONES: Record<
  string,
  string
> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  primary: "border-primary/40 bg-primary/10 text-primary",
  positive: "border-positive/40 bg-positive/10 text-positive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: keyof typeof BADGE_TONES | string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${
        BADGE_TONES[tone] ?? BADGE_TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const BUTTON_TONES: Record<string, string> = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-secondary",
  destructive:
    "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-[13px]",
  lg: "h-9 px-4 text-sm",
};

export function Button({
  tone = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof BUTTON_TONES;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${RING} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stat cell                                                           */
/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  aria,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "warning" | "destructive";
  aria?: string;
}) {
  const valueTone =
    tone === "positive"
      ? "text-positive"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div
      className="flex flex-col gap-0.5"
      aria-label={aria}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-[15px] tabular-nums ${valueTone}`}>
        {value}
      </span>
      {sub ? (
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delta — sign always shown, color assists only                       */
/* ------------------------------------------------------------------ */

export function Delta({
  value,
  context = "compact",
}: {
  value: number | null | undefined;
  context?: "compact" | "detailed";
}) {
  const text = delta(value, context);
  const positive = (value ?? 0) > 0;
  const negative = (value ?? 0) < 0;
  return (
    <span
      className={`font-mono tabular-nums ${
        positive
          ? "text-positive"
          : negative
            ? "text-destructive"
            : "text-muted-foreground"
      }`}
      aria-label={
        positive
          ? `increase of ${text}`
          : negative
            ? `decrease of ${text}`
            : `no change: ${text}`
      }
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal gauge with a maintenance tick                            */
/* ------------------------------------------------------------------ */

export function Gauge({
  value,
  min = 0,
  max = 2,
  marks = [],
  tone = "primary",
  label,
  valueText,
}: {
  value: number | null | undefined;
  min?: number;
  max?: number;
  /** vertical marks [{ at, label, tone }] */
  marks?: Array<{ at: number; label: string; tone?: "warning" | "destructive" | "muted" }>;
  tone?: "primary" | "positive" | "warning" | "destructive";
  label?: string;
  /** exact displayed value (aria + external display) */
  valueText?: string;
}) {
  const ok = value != null && Number.isFinite(value) && value >= min;
  const pctFilled =
    !ok || value == null
      ? 0
      : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const barTone =
    tone === "positive"
      ? "bg-positive"
      : tone === "warning"
        ? "bg-warning"
        : tone === "destructive"
          ? "bg-destructive"
          : "bg-primary";
  const markTone = (t?: string) =>
    t === "warning"
      ? "bg-warning"
      : t === "destructive"
        ? "bg-destructive"
        : "bg-muted-foreground";
  const described =
    label ??
    [
      valueText ? `gauge at ${valueText}` : "gauge",
      ...marks.map((m) => `${m.label} at ${ratio(m.at)}`),
    ].join("; ");
  return (
    <div
      role="img"
      aria-label={described}
      className="flex flex-col gap-1"
    >
      <div className="relative h-2 overflow-hidden rounded-sm bg-secondary">
        <div
          className={`absolute inset-y-0 left-0 rounded-sm transition-[width] duration-150 motion-reduce:transition-none ${barTone}`}
          style={{ width: ok ? `${pctFilled}%` : "0%" }}
        />
        {marks.map((m, i) => (
          <div
            key={i}
            title={m.label}
            className={`absolute w-px inset-y-0 ${markTone(m.tone)}`}
            style={{ left: `${((m.at - min) / (max - min)) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented bar (collateral mix)                                      */
/* ------------------------------------------------------------------ */

export function SegmentedBar({
  segments,
  splitFrac,
}: {
  /** [{ frac (0..1), tone, label, title }] */
  segments: Array<{
    frac: number;
    tone: string;
    label: string;
    title?: string;
  }>;
  /** optional marker line across the bar at this fraction (unwindable split) */
  splitFrac?: number;
}) {
  return (
    <div
      role="img"
      aria-label={segments
        .filter((s) => s.frac > 0)
        .map((s) => s.label)
        .join(", ")}
      className="relative flex h-16 w-full overflow-hidden rounded-md border border-border"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={s.title ?? s.label}
          className={`flex min-w-0 items-end p-2 ${s.tone} border-r border-border/60 last:border-r-0`}
          style={{ width: `${s.frac * 100}%` }}
        >
          <span className="truncate font-mono text-[11px] tabular-nums text-foreground/90">
            {s.label}
          </span>
        </div>
      ))}
      {splitFrac != null ? (
        <div
          title="unwindableNow split"
          className="absolute inset-y-0 w-px bg-foreground/60"
          style={{ left: `${splitFrac * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table helpers — text-left labels, right-aligned mono numerals       */
/* ------------------------------------------------------------------ */

export function Th({
  children,
  numeric = false,
}: {
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      className={`border-b border-border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground ${
        numeric ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  numeric = false,
  mono = false,
  className = "",
}: {
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-border/60 px-3 py-2 text-[13px] ${
        numeric ? "text-right font-mono tabular-nums" : mono ? "font-mono" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-muted ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Nav tab                                                             */
/* ------------------------------------------------------------------ */

export function NavTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${RING} ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
