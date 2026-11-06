/**
 * UI primitives — Quiet Pro.
 * One idea per card, generous padding, hairline borders, single accent.
 * Numbers stay mono + tabular; everything colorized is backed by tokens.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

export const FOCUS =
  "outline-offset-2 outline-0 outline-ring focus-visible:outline-2 motion-reduce:transition-none";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  caption,
  action,
  children,
  className = "",
}: {
  title?: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-border bg-card ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-0 pt-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {caption ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="flex-1 px-5 py-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const BADGE_TONES: Record<string, string> = {
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
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${
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
  primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border-border bg-secondary text-secondary-foreground hover:bg-secondary/70",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-secondary/60",
  destructive:
    "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-[13px]",
  lg: "h-10 px-5 text-sm",
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${FOCUS} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Button as link                                                      */
/* ------------------------------------------------------------------ */

export function ButtonLink({
  href,
  tone = "secondary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  tone?: keyof typeof BUTTON_TONES;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors duration-150 ${FOCUS} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Stat — large numeral with a single calm hint                        */
/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "warning" | "destructive";
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
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-2xl tabular-nums leading-tight ${valueTone}`}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input with label + inline error                                     */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className = "",
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`h-10 w-full rounded-md border bg-input px-3 text-sm text-foreground outline-offset-2 outline-0 outline-ring transition-colors duration-150 focus-visible:outline-2 placeholder:text-muted-foreground/70 aria-invalid:border-destructive ${FOCUS} ${
        invalid ? "border-destructive/60" : "border-border"
      } ${className}`}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox row (labelled)                                             */
/* ------------------------------------------------------------------ */

export function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-[var(--primary)]"
      />
      <span>{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar link                                                        */
/* ------------------------------------------------------------------ */

export function SidebarLink({
  href,
  active,
  children,
  icon,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${FOCUS} ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Table cells                                                         */
/* ------------------------------------------------------------------ */

export function Th({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground ${
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
}: {
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`border-b border-border/50 px-4 py-3 text-[13px] ${
        numeric ? "text-right font-mono tabular-nums" : mono ? "font-mono" : ""
      }`}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Dual-signal bar (collateral allocation)                             */
/* ------------------------------------------------------------------ */

export function AllocationBar({
  segments,
}: {
  segments: Array<{ frac: number; className: string; label: string; title?: string }>;
}) {
  return (
    <div
      role="img"
      aria-label={segments.filter((s) => s.frac > 0).map((s) => s.label).join(", ")}
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={s.title ?? s.label}
          className={s.className}
          style={{ width: `${s.frac * 100}%` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-muted motion-safe:animate-pulse ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
