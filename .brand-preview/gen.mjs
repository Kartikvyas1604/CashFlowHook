// Brand palette generator — CashflowHook
// OKLCH -> sRGB -> WCAG-verified shadcn token sets -> .brand-preview/index.html + palettes.json
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });

/* ---------------- color math ---------------- */
function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [clamp01(r), clamp01(g), clamp01(bl)];
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const linearToGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toHex(L, C, H) {
  const enc = (v) => Math.round(clamp01(linearToGamma(v)) * 255);
  return "#" + oklchToLinear(L, C, H).map((v) => enc(v).toString(16).padStart(2, "0")).join("");
}
function relLum(L, C, H) {
  const [r, g, b] = oklchToLinear(L, C, H);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const la = relLum(a.L, a.C, a.H), lb = relLum(b.L, b.C, b.H);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------- six candidate palettes ---------------- */
const palettes = [
  {
    n: 1, name: "Midnight Signal", vibe: "tech · serious · trustworthy", curated: true,
    dark:  { bg: [0.14, 0.02, 265], bge: [0.19, 0.02, 265], p: [0.72, 0.17, 250], ps: [0.82, 0.11, 250], fg: [0.96, 0.01, 265] },
    light: { bg: [0.98, 0.01, 265], bge: [1.0, 0.0, 0],     p: [0.52, 0.17, 250], ps: [0.72, 0.11, 250], fg: [0.18, 0.02, 265] },
  },
  {
    n: 2, name: "Chromium", vibe: "minimal · technical · sharp", curated: true,
    dark:  { bg: [0.12, 0.0, 0],     bge: [0.17, 0.0, 0],    p: [0.78, 0.18, 140], ps: [0.88, 0.13, 140], fg: [0.97, 0.0, 0] },
    light: { bg: [0.985, 0.0, 0],    bge: [1.0, 0.0, 0],     p: [0.45, 0.18, 140], ps: [0.62, 0.13, 140], fg: [0.16, 0.0, 0] },
  },
  {
    n: 3, name: "Vault Blue", vibe: "premium · calm · serious", curated: true,
    dark:  { bg: [0.15, 0.02, 240],  bge: [0.20, 0.025, 240], p: [0.68, 0.13, 225], ps: [0.80, 0.09, 225], fg: [0.95, 0.015, 240] },
    light: { bg: [0.975, 0.01, 240], bge: [1.0, 0.0, 0],      p: [0.42, 0.13, 225], ps: [0.60, 0.09, 225], fg: [0.16, 0.02, 240] },
  },
  {
    n: 4, name: "Deep Ledger", vibe: "deep indigo · ledger-quiet · serious", curated: false,
    dark:  { bg: [0.115, 0.015, 262], bge: [0.165, 0.018, 262], p: [0.70, 0.12, 262], ps: [0.82, 0.08, 262], fg: [0.96, 0.008, 262] },
    light: { bg: [0.975, 0.008, 262], bge: [1.0, 0.0, 0],       p: [0.46, 0.13, 262], ps: [0.64, 0.09, 262], fg: [0.17, 0.015, 262] },
  },
  {
    n: 5, name: "Cobalt Grid", vibe: "bold cobalt · high-signal · dense", curated: false,
    dark:  { bg: [0.13, 0.022, 250], bge: [0.18, 0.028, 250],  p: [0.76, 0.19, 250], ps: [0.86, 0.13, 250], fg: [0.97, 0.01, 250] },
    light: { bg: [0.98, 0.01, 250],  bge: [1.0, 0.0, 0],       p: [0.47, 0.20, 250], ps: [0.64, 0.15, 250], fg: [0.16, 0.02, 250] },
  },
  {
    n: 6, name: "Quiet Slate", vibe: "cool grayscale · whisper of blue · software", curated: false,
    dark:  { bg: [0.13, 0.008, 240], bge: [0.18, 0.01, 240],  p: [0.71, 0.075, 240], ps: [0.82, 0.05, 240], fg: [0.95, 0.005, 240] },
    light: { bg: [0.97, 0.006, 240], bge: [1.0, 0.0, 0],       p: [0.42, 0.09, 240],  ps: [0.60, 0.05, 240], fg: [0.16, 0.01, 240] },
  },
];

/* ---------------- derivation (shadcn-integration.md) ---------------- */
const T = (s) => ({ L: s[0], C: s[1], H: s[2] });
const clone = (c) => ({ L: c.L, C: c.C, H: c.H });
const fmt = (c) => `oklch(${c.L.toFixed(3)} ${c.C.toFixed(3)} ${c.H.toFixed(1)})`;

function derive(seeds, mode) {
  const BG = T(seeds.bg), BGE = T(seeds.bge), P = T(seeds.p), FG = T(seeds.fg);
  const t = {};
  t.background = clone(BG);
  t.foreground = clone(FG);
  t.card = clone(BGE);
  t.cardForeground = clone(FG);
  t.popover = mode === "dark" ? { L: BGE.L + 0.02, C: BGE.C, H: BGE.H } : clone(BGE);
  t.popoverForeground = clone(FG);
  t.primary = clone(P);
  t.primaryForeground =
    mode === "dark"
      ? (P.L >= 0.70 ? { L: 0.10, C: 0, H: 0 } : { L: 0.97, C: 0, H: 0 })
      : (P.L <= 0.55 ? { L: 0.98, C: 0, H: 0 } : { L: 0.12, C: 0, H: 0 });
  t.secondary = mode === "dark"
    ? { L: BGE.L + 0.04, C: BGE.C + 0.01, H: BGE.H }
    : { L: BG.L - 0.04, C: BG.C + 0.005, H: BG.H };
  t.secondaryForeground = clone(FG);
  t.muted = mode === "dark"
    ? { L: BGE.L + 0.02, C: BGE.C, H: BGE.H }
    : { L: BG.L - 0.03, C: BG.C, H: BG.H };
  t.mutedForeground = mode === "dark"
    ? { L: Math.max(0.60, FG.L - 0.30), C: FG.C, H: FG.H }
    : { L: Math.min(0.45, FG.L + 0.30), C: FG.C, H: FG.H };
  t.accent = mode === "dark"
    ? { L: BGE.L + 0.06, C: BGE.C + 0.01, H: P.H }
    : { L: BG.L - 0.05, C: BG.C + 0.01, H: P.H };
  t.accentForeground = clone(FG);
  t.destructive = mode === "dark" ? { L: 0.65, C: 0.22, H: 25 } : { L: 0.55, C: 0.22, H: 25 };
  t.destructiveForeground = { L: 0.98, C: 0, H: 0 };
  t.border = mode === "dark"
    ? { L: BGE.L + 0.08, C: BGE.C + 0.01, H: BGE.H }
    : { L: BG.L - 0.08, C: BG.C, H: BG.H };
  t.input = mode === "dark" ? clone(BGE) : { L: BG.L - 0.02, C: BG.C, H: BG.H };
  t.ring = { L: P.L, C: P.C, H: P.H };
  return t;
}

/* ---------------- verify + auto-nudge (contrast-rules.md) ---------------- */
const PAIRS = [
  ["foreground", "background", 4.5], ["foreground", "card", 4.5], ["foreground", "popover", 4.5],
  ["foreground", "muted", 4.5], ["mutedForeground", "background", 4.5], ["mutedForeground", "card", 4.5],
  ["primaryForeground", "primary", 4.5], ["secondaryForeground", "secondary", 4.5],
  ["accentForeground", "accent", 4.5], ["destructiveForeground", "destructive", 4.5],
  ["primary", "background", 3.0], ["ring", "background", 3.0], ["border", "background", 1.5],
];

function failures(tokens, mode) {
  const out = [];
  for (const [fgk, bgk, min] of PAIRS) {
    const r = ratio(tokens[fgk], tokens[bgk]);
    if (r < min) out.push({ fgk, bgk, min, got: r });
  }
  return out;
}

function nudge(tokens, f, mode) {
  const dark = mode === "dark";
  const d = (x) => clamp01(x);
  switch (f.fgk) {
    case "mutedForeground":
      tokens.mutedForeground.L = d(tokens.mutedForeground.L + (dark ? 0.04 : -0.04));
      break;
    case "primaryForeground":
      tokens.primaryForeground = tokens.primaryForeground.L > 0.5
        ? { L: 0.12, C: 0, H: 0 }
        : { L: 0.98, C: 0, H: 0 };
      break;
    case "primary":
    case "ring":
      tokens.primary.L = d(tokens.primary.L + (dark ? 0.03 : -0.03));
      tokens.ring.L = tokens.primary.L;
      break;
    case "destructive":
      tokens.destructive.L = d(tokens.destructive.L + (dark ? 0.03 : -0.02));
      break;
    case "destructiveForeground":
      tokens.destructive.L = d(tokens.destructive.L + (dark ? -0.03 : 0.03));
      break;
    case "border":
      tokens.border.L = d(tokens.border.L + (dark ? 0.05 : -0.05));
      break;
    case "secondary":
      tokens.secondary.L = d(tokens.secondary.L + (dark ? 0.04 : -0.04));
      break;
    case "accent":
      tokens.accent.L = d(tokens.accent.L + (dark ? 0.04 : -0.04));
      break;
    case "foreground":
      tokens.foreground.L = d(tokens.foreground.L + (dark ? 0.03 : -0.02));
      break;
  }
}

for (const pal of palettes) {
  pal.modes = {};
  for (const mode of ["dark", "light"]) {
    const tokens = derive(pal[mode], mode);
    for (let round = 0; round < 4; round++) {
      const fs = failures(tokens, mode);
      if (!fs.length) break;
      fs.forEach((f) => nudge(tokens, f, mode));
    }
    const remaining = failures(tokens, mode);
    if (remaining.length) {
      console.error(`FAIL ${pal.name} ${mode}: ` + remaining.map((f) => `${f.fgk}/${f.bgk} (${f.got.toFixed(2)} < ${f.min})`).join(", "));
    }
    const seedRoles = ["bg", "bge", "p", "ps", "fg"];
    const seedNames = ["bg-base", "bg-elevated", "primary", "primary-soft", "fg-base"];
    pal.modes[mode] = {
      seeds: seedRoles.map((k, i) => ({
        role: seedNames[i],
        oklch: fmt(T(pal[mode][k])),
        hex: toHex(...pal[mode][k]),
      })),
      tokens, passing: remaining.length === 0,
    };
  }
}

/* ---------------- report ---------------- */
const report = palettes.map((pal) => {
  const modes = {};
  for (const mode of ["dark", "light"]) {
    const t = pal.modes[mode].tokens;
    modes[mode] = {
      seeds: pal.modes[mode].seeds,
      ratios: {
        bodyOnPage: +ratio(t.foreground, t.background).toFixed(2),
        helperOnPage: +ratio(t.mutedForeground, t.background).toFixed(2),
        btnLabel: +ratio(t.primaryForeground, t.primary).toFixed(2),
        primaryOnPage: +ratio(t.primary, t.background).toFixed(2),
      },
      tokens: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { oklch: fmt(v), hex: toHex(v.L, v.C, v.H) }])),
    };
  }
  return { n: pal.n, name: pal.name, vibe: pal.vibe, curated: pal.curated, modes };
});
writeFileSync(join(here, "palettes.json"), JSON.stringify(report, null, 2));

for (const e of report) {
  const d = e.modes.dark.ratios, l = e.modes.light.ratios;
  console.log(`${e.n}. ${e.name} [${e.vibe}]`);
  console.log(`   dark  body ${d.bodyOnPage}  helper ${d.helperOnPage}  btn ${d.btnLabel}  primary ${d.primaryOnPage}`);
  console.log(`   light body ${l.bodyOnPage}  helper ${l.helperOnPage}  btn ${l.btnLabel}  primary ${l.primaryOnPage}`);
}

/* ---------------- preview html ---------------- */
function varSet(t) {
  return [
    `--bg:${fmt(t.background)}`, `--fg:${fmt(t.foreground)}`,
    `--card:${fmt(t.card)}`, `--card-fg:${fmt(t.cardForeground)}`,
    `--primary:${fmt(t.primary)}`, `--primary-fg:${fmt(t.primaryForeground)}`,
    `--muted:${fmt(t.muted)}`, `--muted-fg:${fmt(t.mutedForeground)}`,
    `--secondary:${fmt(t.secondary)}`,
    `--border:${fmt(t.border)}`, `--ring:${fmt(t.ring)}`,
    `--input-bg:${fmt(t.input)}`, `--destructive:${fmt(t.destructive)}`,
    `--radius:10px`,
  ].join(",");
}

const miniUI = `
        <div>
          <p class="muted" style="margin-bottom:4px">Borrowing power</p>
          <h3 class="headline" style="font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums">$128,450 <span style="font-size:16px;opacity:.6">USDC</span></h3>
          <p class="muted">Fee credit + coupon accrual · 10% cap applied</p>
          <div class="buttons" style="margin-top:16px">
            <button class="btn btn-primary">Draw</button>
            <button class="btn btn-secondary">Repay</button>
          </div>
          <p class="muted" style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.02em;margin-top:10px">NON-CUSTODIAL · AQUA VIRTUAL BALANCE</p>
        </div>
        <div class="card">
          <p class="card-label">Coupon accrued today</p>
          <p class="card-value">+$6.02</p>
          <p class="card-sub">OUSG NAV accrual · tx 0x7f3a…c91d</p>
          <div style="margin-top:12px;height:8px;border-radius:4px;overflow:hidden;background:var(--muted)">
            <div style="width:82%;height:100%;background:var(--primary)"></div>
          </div>
          <p class="muted" style="margin-top:8px;font-size:11px">Unwindable $96.4k · earning-but-locked $9.8k</p>
        </div>`;

const sections = palettes.map((pal) => {
  const d = pal.modes.dark, l = pal.modes.light;
  const swatches = (mode) => pal.modes[mode].seeds
    .map((s) => `<div class="swatch" style="background:${s.hex}"><span class="swatch-label">${s.hex}</span></div>`)
    .join("");
  const strip = (mode, r) => `<div class="contrast"><span>body ${r.bodyOnPage}:1</span><span>helper ${r.helperOnPage}:1</span><span>btn ${r.btnLabel}:1</span><span>primary ${r.primaryOnPage}:1</span><span style="margin-left:auto">${pal.passAA !== false ? "AA" : "check"}</span></div>`;
  const dr = report[pal.n - 1].modes.dark.ratios, lr = report[pal.n - 1].modes.light.ratios;
  const contrastRow = mode => {
    const r = mode === "dark" ? dr : lr;
    return `<div class="contrast" ${mode === "light" ? 'style="display:none" data-for="light"' : ""}>
      <span>body ${r.bodyOnPage}:1</span><span>helper ${r.helperOnPage}:1</span><span>btn ${r.btnLabel}:1</span><span>primary ${r.primaryOnPage}:1</span><span style="margin-left:auto">${pal.modes[mode].passing ? "AA" : "FIX"}</span>
    </div>`;
  };
  return `
    <article class="palette"
      data-dark="${varSet(d.tokens).replace(/"/g, "&quot;")}"
      data-light="${varSet(l.tokens).replace(/"/g, "&quot;")}"
      style="${varSet(d.tokens)}">
      <header class="palette-header">
        <div>
          <h2 class="palette-name"><span class="palette-number">${pal.n}</span>${pal.name}</h2>
          <p class="palette-vibe">${pal.vibe} · ${pal.curated ? "curated recipe" : "generated variant"}</p>
        </div>
      </header>
      <div class="swatches">${swatches("dark")}</div>
      <div class="ui">${miniUI}</div>
      <div class="contrast dark-contrast"><span>dark — body ${dr.bodyOnPage}:1</span><span>helper ${dr.helperOnPage}:1</span><span>btn ${dr.btnLabel}:1</span><span>primary ${dr.primaryOnPage}:1</span><span style="margin-left:auto">${d.passing ? "AA" : "FIX"}</span></div>
      <div class="contrast light-contrast" style="display:none"><span>light — body ${lr.bodyOnPage}:1</span><span>helper ${lr.helperOnPage}:1</span><span>btn ${lr.btnLabel}:1</span><span>primary ${lr.primaryOnPage}:1</span><span style="margin-left:auto">${l.passing ? "AA" : "FIX"}</span></div>
    </article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Brand palette — CashflowHook</title>
<style>
  :root { font-family: system-ui, -apple-system, "Segoe UI", Inter, sans-serif; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html[data-theme="dark"] body { background: #0a0a0a; color: #f5f5f5; }
  html[data-theme="light"] body { background: #ececec; color: #0a0a0a; }
  .muted { font-size: 12px; color: var(--muted-fg); }
  .topbar { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(12px); background: color-mix(in srgb, currentColor 7%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
  .topbar h1 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .topbar .hint { font-size: 13px; opacity: .6; margin: 2px 0 0; }
  .topbar .toggle { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); background: transparent; color: inherit; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
  .topbar .toggle:hover { background: color-mix(in srgb, currentColor 9%, transparent); }
  .container { max-width: 920px; margin: 0 auto; padding: 32px 20px 80px; display: grid; gap: 28px; }
  .palette { border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 10px 36px rgba(0,0,0,.22); background: var(--bg); color: var(--fg); }
  .palette-header { padding: 18px 22px 12px; border-bottom: 1px solid var(--border); }
  .palette-number { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; background: var(--primary); color: var(--primary-fg); font-weight: 600; font-size: 13px; margin-right: 10px; }
  .palette-name { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
  .palette-vibe { font-size: 12.5px; color: var(--muted-fg); margin: 4px 0 0; letter-spacing: .02em; }
  .swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border); }
  .swatch { aspect-ratio: 2.4 / 1; position: relative; }
  .swatch-label { position: absolute; inset: auto 0 0 0; padding: 5px 6px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; text-align: center; color: #fff; background: rgba(0,0,0,.38); letter-spacing: .02em; }
  .ui { padding: 22px; display: grid; grid-template-columns: 1.1fr .9fr; gap: 20px; }
  @media (max-width: 700px) { .ui { grid-template-columns: 1fr; } }
  .headline { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 6px; }
  .buttons { display: flex; gap: 8px; }
  .btn { font-family: inherit; font-size: 13px; font-weight: 500; padding: 9px 14px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; }
  .btn-primary { background: var(--primary); color: var(--primary-fg); }
  .btn-primary:hover { filter: brightness(1.06); }
  .btn-secondary { background: transparent; color: var(--fg); border-color: var(--border); }
  .btn-secondary:hover { background: var(--muted); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; color: var(--card-fg); }
  .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-fg); margin: 0 0 6px; }
  .card-value { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; font-size: 24px; font-weight: 600; margin: 0; }
  .card-sub { font-size: 12px; color: var(--muted-fg); margin: 4px 0 0; }
  .contrast { padding: 12px 22px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--card) 55%, var(--bg)); color: var(--muted-fg); font-size: 12px; display: flex; gap: 18px; flex-wrap: wrap; }
  .contrast span::before { content: "\\2713 "; color: oklch(0.72 0.17 155); font-weight: 700; }
  .footer-cta { text-align: center; padding: 28px; opacity: .72; font-size: 14px; }
  .footer-cta code { font-family: ui-monospace, Menlo, monospace; background: color-mix(in srgb, currentColor 10%, transparent); padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>Brand palette — CashflowHook</h1>
      <p class="hint">AI-agent credit line · human cosign · one grid over equity, LP fees, treasury NAV</p>
    </div>
    <button class="toggle" id="theme-toggle">Switch to Light</button>
  </div>
  <div class="container">
  ${sections}
    <div class="footer-cta">
      Pick one — reply with the number in chat.<br />
      Variations: <code>more like 3</code>, <code>more versus</code>, <code>more warm</code>, <code>none</code>.
    </div>
  </div>
  <script>
    (() => {
      const root = document.documentElement, btn = document.getElementById('theme-toggle');
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        btn.textContent = next === 'dark' ? 'Switch to Light' : 'Switch to Dark';
        document.querySelectorAll('.palette').forEach(el => {
          const tokens = next === 'dark' ? el.dataset.dark : el.dataset.light;
          if (tokens) el.setAttribute('style', tokens);
        });
        document.querySelectorAll('.dark-contrast').forEach(el => el.style.display = next === 'dark' ? '' : 'none');
        document.querySelectorAll('.light-contrast').forEach(el => el.style.display = next === 'light' ? '' : 'none');
      });
    })();
  </script>
</body>
</html>`;

writeFileSync(join(here, "index.html"), html);
console.log("preview built:", join(here, "index.html"));
