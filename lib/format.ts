/**
 * display formatting — implements the number-formatting spec v1.0
 * (en-US fixed, half-away-from-zero rounding, no scientific notation,
 * no signed zero, "--" for null/missing, tabular numerals assumed on
 * the consumer side via `font-mono tabular-nums`).
 *
 * Display-only: internal math elsewhere uses raw precision.
 */

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const INVALID = "--";
type Context = "compact" | "detailed";

/** half away from zero at `decimals` places. Rule §3.2. */
function roundHalfAway(x: number, decimals: number): number {
  if (!Number.isFinite(x)) return x;
  const scale = 10 ** decimals;
  const scaled = x * scale;
  const rounded =
    scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / scale;
}

function fixed(x: number, decimals: number): string {
  return Math.abs(x).toFixed(decimals); // sign handled by callers; avoids "-0.00"
}

function withCommas(numeric: string): string {
  const neg = numeric.startsWith("-");
  const core = neg ? numeric.slice(1) : numeric;
  const [int, frac] = core.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/** strips trailing fractional zeros ("25.60" → "25.6", "25.00" → "25") */
function trimmed(numeric: string): string {
  return numeric.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function leadingZerosAfterDecimal(abs: number): number {
  const dec = Math.abs(abs).toFixed(20); // never scientific (rule §3.3)
  let zeros = 0;
  let idx = dec.indexOf(".") + 1;
  while (dec[idx] === "0" && zeros < 20) {
    zeros += 1;
    idx += 1;
  }
  return zeros;
}

function zeroSubscript(
  x: number,
  sigDigits: number,
  prefix: string,
  suffix: string
): string {
  const abs = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  const dec = abs.toFixed(20);
  let zeros = 0;
  let idx = dec.indexOf(".") + 1;
  while (dec[idx] === "0") {
    zeros += 1;
    idx += 1;
  }
  const sig = dec.slice(idx, idx + sigDigits);
  return `${prefix}${sign}0.0${SUBSCRIPTS[zeros]}${sig}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* fiat value / stable value                                           */
/* ------------------------------------------------------------------ */

/**
 * "$" prefix, 2 decimals always, trailing zeros kept, zero = "$0.00",
 * tiny = "<$0.01". compact abbreviates >= 1K; detailed never abbreviates.
 * signed: delta context — always carries "+"/"−"; zero never signed.
 */
export function fiat(
  value: number | null | undefined,
  context: Context = "compact",
  { signed = false }: { signed?: boolean } = {}
): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);

  if (abs === 0) return "$0.00"; // signed zero forbidden (rule §3.6)
  const sign = value < 0 ? "-" : signed ? "+" : "";

  if (abs < 0.01) return `${sign}<$0.01`;

  if (context === "compact" && abs >= 1_000) {
    const units: Array<[number, string]> = [
      [1e12, "T"],
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [scale, suffix] of units) {
      if (abs >= scale) {
        const n = trimmed(roundHalfAway(abs / scale, 1).toFixed(1));
        return `${sign}$${n}${suffix}`;
      }
    }
  }
  return `${sign}$${withCommas(fixed(abs, 2))}`;
}

/* ------------------------------------------------------------------ */
/* signed delta — PnL/change context: sign always shown                */
/* ------------------------------------------------------------------ */

export function delta(
  value: number | null | undefined,
  context: Context = "compact"
): string {
  return fiat(value, context, { signed: true });
}

/* ------------------------------------------------------------------ */
/* percent                                                             */
/* ------------------------------------------------------------------ */

/** "%" suffix, default 2 decimals, tiny = "<0.01%", never abbreviate. */
export function pct(
  value: number | null | undefined,
  { decimals }: { decimals?: number } = {}
): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);
  if (abs === 0) return "0%";
  if (abs < 0.0001) return "<0.01%";
  const d = decimals ?? (abs >= 1_000 ? 0 : abs >= 100 ? 1 : 2);
  return `${value < 0 ? "-" : ""}${withCommas(trimmed(fixed(abs, d)))}%`;
}

/* ------------------------------------------------------------------ */
/* ratio (health, coverage)                                            */
/* ------------------------------------------------------------------ */

/** "x" suffix, up to 2 decimals, trim zeros, never abbreviate. */
export function ratio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);
  if (roundHalfAway(abs, 2) === 0) return "<0.01x";
  return `${value < 0 ? "-" : ""}${withCommas(trimmed(fixed(abs, 2)))}x`;
}

/* ------------------------------------------------------------------ */
/* plain mono number (shares, counts)                                  */
/* ------------------------------------------------------------------ */

export function num(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);
  const rounded = roundHalfAway(abs, decimals);
  if (rounded === 0) {
    return abs > 0 && decimals < 3
      ? `<${(0.1 ** decimals).toFixed(decimals)}`
      : fixed(0, decimals); // no signed zero
  }
  return (value < 0 ? "-" : "") + withCommas(fixed(value, decimals));
}

/* ------------------------------------------------------------------ */
/* token amount                                                        */
/* ------------------------------------------------------------------ */

/**
 * detailed shows the raw amount with commas; compact abbreviates >= 1K
 * (one decimal, trimmed). zero-subscript when 3+ leading zeros after the
 * decimal point (sig digits compact 2 / detailed 4).
 */
export function tokenAmount(
  value: number | null | undefined,
  context: Context = "detailed",
  { symbol, decimals }: { symbol?: string; decimals?: number } = {}
): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const sym = symbol ? ` ${symbol}` : "";

  if (abs === 0) return `0${sym}`;

  if (leadingZerosAfterDecimal(abs) >= 3) {
    return `${zeroSubscript(value, context === "compact" ? 2 : 4, "", sym)}`;
  }

  if (context === "compact" && abs >= 1_000) {
    const units: Array<[number, string]> = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [scale, suffix] of units) {
      if (abs >= scale) {
        return `${sign}${trimmed(roundHalfAway(abs / scale, 1).toFixed(1))}${suffix}${sym}`;
      }
    }
  }

  if (context === "compact") {
    return `${sign}${withCommas(trimmed(roundHalfAway(abs, 2).toFixed(2)))}${sym}`;
  }

  const d = decimals ?? (abs >= 10_000 ? 4 : abs >= 100 ? 5 : 6);
  return `${sign}${withCommas(fixed(abs, d))}${sym}`;
}

/* ------------------------------------------------------------------ */
/* token price (mark, NAV per share)                                   */
/* ------------------------------------------------------------------ */

export function tokenPrice(
  value: number | null | undefined,
  context: Context = "detailed"
): string {
  if (value == null || !Number.isFinite(value)) return INVALID;
  const abs = Math.abs(value);
  if (abs === 0) return "$0.00";
  if (abs >= 1_000) return `$${withCommas(fixed(abs, 2))}`;
  if (abs >= 100) {
    // compact: 0 decimals (3 sig digits); detailed: 2 decimals
    return context === "compact"
      ? `$${withCommas(fixed(abs, 0))}`
      : `$${withCommas(fixed(abs, 2))}`;
  }
  if (abs >= 1) {
    // compact: 1 decimal (3 sig digits); detailed: 3 decimals (5 sig digits)
    return context === "compact"
      ? `$${roundHalfAway(abs, 1).toFixed(1)}`
      : `$${fixed(abs, 3)}`;
  }
  // < $1
  if (leadingZerosAfterDecimal(abs) >= 3) {
    return zeroSubscript(value, context === "compact" ? 2 : 4, "$", "");
  }
  return context === "compact"
    ? `$${trimmed(roundHalfAway(abs, 3).toFixed(3))}` // 3 sig digits
    : `$${trimmed(fixed(abs, Math.min(8, leadingZerosAfterDecimal(abs) + 5)))}`; // 5 sig digits
}

/* ------------------------------------------------------------------ */
/* durations / clock (fixture feeds show UTC times)                     */
/* ------------------------------------------------------------------ */

export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return INVALID;
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function utcClock(epochSeconds: number | null | undefined): string {
  if (epochSeconds == null || !Number.isFinite(epochSeconds)) return INVALID;
  const t = new Date(epochSeconds * 1000);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${String(t.getUTCDate()).padStart(2, "0")} ${hh}:${mm} UTC`;
}
