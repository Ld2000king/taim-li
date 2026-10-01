/*
 * "תיאבון" — the SuperUI pass. Layers a bolder, warmer look over the pages:
 * one switchable accent (default: paprika), light + dark mode, Rubik, grouped
 * cards, gradient CTAs, and an "המראה שלך" sheet (sun/moon toggle, accent
 * swatches, live preview, staged changes with a pending bar).
 *
 * Idempotent: everything it adds sits between /* SUPER:... *\/ or <!--SUPER:...-->
 * markers and is replaced on every run.
 *
 *   node src/stitch.mjs   (from src/)  -> src/bis-business-app.html
 *   node src/apply-super.mjs           -> restyles the pages listed below
 *   node build.mjs                     -> standalone pages at the repo root
 */
import fs from 'node:fs';

const PAGES = [
    { file: 'src/bis-live-customer.html', kind: 'app' },
    { file: 'src/bis-business-app.html',  kind: 'app' },
    { file: 'src/bis-concept.html',       kind: 'concept' },
    { file: 'index.html',                 kind: 'home' }
];

const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap" />';

/* ---------------------------------------------------------------------------
   tokens
   --------------------------------------------------------------------------- */
const TOKENS = `
@property --accent { syntax: '<color>'; inherits: true; initial-value: #E64A19; }
:root {
    /* ---- one accent drives everything; swapped live from the sheet ---- */
    --accent: #E64A19;                 /* פפריקה */
    --accent-hot: var(--accent);       /* gradient partner, hue-shifted below */
    --urgent: #D61F69;                 /* expiring · destructive — semantic, not brand */

    /* ---- warm, appetising neutrals ---- */
    --bg: #FFF7F2;
    --bg-edge: #F9E9DF;
    --surface: #FFFFFF;
    --raised: #FFF0E7;
    --border: #F3E1D6;
    --text: #1F1411;
    --muted: #725E56;
    --faint: #8C776E;

    --accent-deep: color-mix(in srgb, var(--accent) 80%, #000);
    --accent-soft: color-mix(in srgb, var(--accent) 12%, var(--surface));
    --accent-line: color-mix(in srgb, var(--accent) 32%, var(--surface));
    --urgent-soft: color-mix(in srgb, var(--urgent) 11%, var(--surface));
    --grad: linear-gradient(135deg, var(--accent) 0%, var(--accent-hot) 100%);
    --glow: 0 10px 26px -6px color-mix(in srgb, var(--accent) 60%, transparent);

    --shadow-card: 0 1px 2px rgba(80, 30, 10, .04), 0 6px 20px rgba(80, 30, 10, .06);
    --shadow-pop: 0 4px 10px rgba(80, 30, 10, .06), 0 24px 52px rgba(80, 30, 10, .16);
    --scrim: rgba(36, 14, 6, .5);
    --topbar: color-mix(in srgb, var(--bg) 82%, transparent);

    --font-display: 'Rubik', 'Heebo', system-ui, sans-serif;
    --font-ui: 'Rubik', 'Heebo', system-ui, -apple-system, 'Segoe UI', sans-serif;

    /* ---- UI style: Rounded (default) · Soft · Crisp ---- */
    --r-card: 24px;
    --r-card-lg: 30px;
    --r-tile: 14px;
    --r-field: 16px;
    --r-btn: 999px;
    --r-chip: 999px;
    --ts: 1;                           /* text size: .9 · 1 · 1.12 · 1.25 */

    /* ---- legacy role names, so every older rule follows the new palette ---- */
    --paper: var(--bg);
    --paper-edge: var(--bg-edge);
    --card: var(--surface);
    --card-2: var(--raised);
    --line: var(--border);
    --ink: var(--text);
    --ink-soft: var(--muted);
    --ink-faint: var(--faint);
    --teal: var(--accent);
    --teal-deep: var(--accent-deep);
    --teal-tint: var(--accent-soft);
    --pink: var(--urgent);
    --pink-tint: var(--urgent-soft);
    --sage: var(--accent);
    --sage-tint: var(--accent-soft);
    --clay: var(--accent);
    --clay-deep: var(--accent-deep);
    --clay-tint: var(--accent-soft);
    --honey: var(--urgent);
    --honey-tint: var(--urgent-soft);
    --plum: var(--muted);
    --plum-tint: var(--raised);
    --plum-line: var(--border);
    --rose: var(--urgent);
    --rose-tint: var(--urgent-soft);
    --shadow-soft: var(--shadow-card);
    --shadow-lift: var(--shadow-pop);
    --shadow-depth-sm: var(--shadow-card);
    --shadow-depth-md: var(--shadow-card);
    --shadow-depth-lg: var(--shadow-pop);
    --radius-sm: var(--r-field);
    --radius-tile: var(--r-field);
    --radius-btn: var(--r-btn);
    --radius-card: var(--r-card);
    --radius-frame: var(--r-card-lg);

    color-scheme: light;
    transition: --accent .25s ease-out;
}
:root[data-ui="soft"]  { --r-card: 16px; --r-card-lg: 20px; --r-tile: 11px; --r-field: 12px; --r-btn: 14px; --r-chip: 12px; }
:root[data-ui="crisp"] { --r-card: 10px; --r-card-lg: 12px; --r-tile: 7px;  --r-field: 8px;  --r-btn: 8px;  --r-chip: 6px; }
/* text size scales the page content; the appearance sheet and its bar stay put */
body > :not(.su-wrap, .su-pending, .su-toast, .su-open, script, style) { zoom: var(--ts); }
.su-preview { zoom: var(--ts); }
@supports (color: oklch(from red l c h)) {
    :root { --accent-hot: oklch(from var(--accent) calc(l + .03) c calc(h - 32)); }
}
:root[data-theme="dark"] {
    --urgent: #FF4F93;
    --bg: #140E0C;
    --bg-edge: #0B0807;
    --surface: #1E1613;
    --raised: #2A1F1B;
    --border: rgb(255 255 255 / .08);
    --text: #FBF1EC;
    --muted: #BFA9A0;
    --faint: #9C877E;
    --accent-deep: color-mix(in srgb, var(--accent) 62%, #fff);
    --accent-soft: color-mix(in srgb, var(--accent) 20%, var(--surface));
    --accent-line: color-mix(in srgb, var(--accent) 45%, var(--surface));
    --urgent-soft: color-mix(in srgb, var(--urgent) 18%, var(--surface));
    --shadow-card: none;
    --shadow-pop: 0 24px 60px rgba(0, 0, 0, .55);
    --scrim: rgba(0, 0, 0, .62);
    color-scheme: dark;
}
`;

/* ---------------------------------------------------------------------------
   shared UI: the appearance sheet + its trigger (every page)
   --------------------------------------------------------------------------- */
const SHEET_CSS = `
body { transition: background-color .35s ease, color .35s ease; }

.su-open {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    display: grid; place-items: center; cursor: pointer;
    background: var(--surface); color: var(--accent-deep);
    border: 1px solid var(--border); box-shadow: var(--shadow-card);
    transition: transform .18s cubic-bezier(.34,1.56,.64,1), background .35s, border-color .35s;
}
.su-open svg { width: 20px; height: 20px; }
.su-open:active { transform: scale(.92); }
.su-open.su-float {
    position: fixed; z-index: 60; bottom: calc(18px + env(safe-area-inset-bottom)); left: 18px;
    width: 48px; height: 48px; box-shadow: var(--shadow-pop);
}

.su-wrap {
    position: fixed; inset: 0; z-index: 200; background: var(--scrim);
    opacity: 0; pointer-events: none; transition: opacity .28s ease;
    font-family: var(--font-ui); direction: rtl; color: var(--text);
}
.su-wrap.show { opacity: 1; pointer-events: auto; }
.su-sheet {
    position: absolute; inset-inline: 0; bottom: 0; margin: 0 auto;
    max-width: 460px; max-height: 92dvh; overflow-y: auto;
    background: var(--bg); border-radius: var(--r-card-lg) var(--r-card-lg) 0 0;
    padding: 10px 20px calc(110px + env(safe-area-inset-bottom));
    transform: translateY(105%); transition: transform .34s cubic-bezier(.22,1,.36,1), background-color .35s;
}
.su-wrap.show .su-sheet { transform: none; }
.su-grip { width: 42px; height: 5px; border-radius: 999px; background: var(--border); margin: 0 auto 14px; }
.su-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.su-head h2 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.5px; line-height: 1.15; }
.su-head p { font-size: 14px; color: var(--muted); margin-top: 4px; }
.su-x {
    width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
}
.su-x svg { width: 18px; height: 18px; }

.su-label {
    display: flex; justify-content: space-between; align-items: baseline;
    margin: 24px 4px 10px; font-size: 12px; font-weight: 600; letter-spacing: 1.2px; color: var(--muted);
}
.su-label span { letter-spacing: 0; color: var(--accent-deep); font-weight: 700; }
.su-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    box-shadow: var(--shadow-card); transition: background-color .35s, border-color .35s;
}

/* live preview: a mini offer card */
.su-preview { margin-top: 18px; padding: 12px; display: flex; gap: 12px; align-items: stretch; }
.su-pv-media {
    width: 96px; flex-shrink: 0; border-radius: var(--r-field); background: var(--grad);
    position: relative; overflow: hidden; min-height: 112px;
}
.su-pv-media::before, .su-pv-media::after {
    content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,.9);
}
.su-pv-media::before { width: 64px; height: 64px; top: 24px; right: 16px; }
.su-pv-media::after { width: 34px; height: 34px; top: 39px; right: 31px; background: color-mix(in srgb, var(--accent) 70%, #FFD08A); }
.su-pv-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.su-pv-chip {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 5px;
    background: var(--urgent-soft); color: var(--urgent); font-weight: 700; font-size: 12px;
    padding: 3px 9px; border-radius: var(--r-btn); font-variant-numeric: tabular-nums;
}
.su-pv-body b { font-size: 17px; font-weight: 700; margin-top: 4px; }
.su-pv-body small { font-size: 12.5px; color: var(--muted); }
.su-pv-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; }
.su-pv-tag { font-size: 12px; font-weight: 600; color: var(--accent-deep); background: var(--accent-soft); padding: 4px 10px; border-radius: var(--r-btn); }
.su-pv-cta { font-size: 13px; font-weight: 700; color: #fff; background: var(--grad); padding: 7px 14px; border-radius: var(--r-btn); box-shadow: var(--glow); }

/* settings row */
.su-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 68px; }
.su-tile {
    width: 40px; height: 40px; border-radius: var(--r-tile); flex-shrink: 0;
    display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-deep);
    transition: background-color .25s, color .25s;
}
.su-tile svg { width: 21px; height: 21px; }
.su-txt { flex: 1; min-width: 0; }
.su-txt b { display: block; font-size: 16px; font-weight: 600; }
.su-txt small { display: block; font-size: 13px; color: var(--muted); margin-top: 1px; }

/* sun / moon toggle — light: sun on sky; dark: moon among stars */
.su-daynight {
    position: relative; width: 62px; height: 34px; border-radius: var(--r-btn); border: 0; flex-shrink: 0;
    background: #CFE3FF; cursor: pointer; overflow: hidden; transition: background-color .35s ease;
}
.su-daynight::before {           /* cloud */
    content: ''; position: absolute; left: 9px; bottom: 6px; width: 18px; height: 7px; border-radius: var(--r-btn);
    background: #fff; box-shadow: 5px -4px 0 -1px #fff; transition: opacity .25s, transform .35s;
}
.su-daynight .thumb {
    position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border-radius: 50%;
    background: #FFA62B; box-shadow: 0 0 0 4px rgba(255, 166, 43, .28);
    transition: transform .34s cubic-bezier(.34,1.56,.64,1), background-color .3s, box-shadow .3s;
}
.su-daynight .thumb::after {     /* the bite that makes the crescent */
    content: ''; position: absolute; width: 20px; height: 20px; border-radius: 50%;
    top: -3px; left: -5px; background: #262150; transform: scale(0); transition: transform .3s ease;
}
.su-daynight .stars i {
    position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #fff;
    opacity: 0; transform: scale(.3); transition: opacity .3s .1s, transform .3s .1s;
}
.su-daynight .stars i:nth-child(1) { top: 8px; right: 14px; }
.su-daynight .stars i:nth-child(2) { top: 18px; right: 24px; width: 2px; height: 2px; }
.su-daynight .stars i:nth-child(3) { top: 11px; right: 32px; }
.su-daynight[aria-checked="true"] { background: #262150; }
.su-daynight[aria-checked="true"]::before { opacity: 0; transform: translateX(-8px); }
.su-daynight[aria-checked="true"] .thumb { transform: translateX(-28px); background: #F5F1FF; box-shadow: 0 0 10px rgba(245, 241, 255, .35); }
.su-daynight[aria-checked="true"] .thumb::after { transform: scale(1); }
.su-daynight[aria-checked="true"] .stars i { opacity: 1; transform: scale(1); }

/* accent swatches */
.su-swatches { display: flex; justify-content: space-between; padding: 16px 18px; }
.su-sw {
    width: 42px; height: 42px; border-radius: 50%; border: 0; cursor: pointer;
    display: grid; place-items: center; color: #fff; position: relative;
    transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
}
.su-sw svg { width: 18px; height: 18px; transform: scale(0); transition: transform .22s cubic-bezier(.34,1.56,.64,1); }
.su-sw[aria-checked="true"] { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--sw); }
.su-sw[aria-checked="true"] svg { transform: scale(1); }
.su-sw:active { transform: scale(.9); }
.su-sw-names { display: flex; justify-content: space-between; padding: 0 12px 14px; margin-top: -6px; }
.su-sw-names span { width: 54px; text-align: center; font-size: 11px; color: var(--faint); font-weight: 500; transition: color .2s; }
.su-sw-names span.on { color: var(--accent-deep); font-weight: 700; }

/* staged changes */
.su-pending {
    position: fixed; z-index: 210; bottom: calc(14px + env(safe-area-inset-bottom));
    left: 50%; width: min(420px, calc(100% - 40px));
    display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 10px;
    padding-inline-start: 18px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    box-shadow: 0 8px 30px rgba(40, 14, 4, .16);
    transform: translate(-50%, 180%); transition: transform .3s cubic-bezier(.22,1,.36,1);
    direction: rtl; font-family: var(--font-ui); color: var(--text);
}
.su-pending:not(.show) { opacity: 0; pointer-events: none; transition: transform .3s cubic-bezier(.22,1,.36,1), opacity 0s .3s; }
.su-pending.show { transform: translate(-50%, 0); opacity: 1; transition: transform .3s cubic-bezier(.22,1,.36,1); }
.su-pending .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.su-pending .n { font-size: 14px; font-weight: 600; flex: 1; }
.su-pending button { border: 0; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 14px; }
.su-pending .discard { background: none; color: var(--muted); padding: 10px 8px; }
.su-pending .review { background: var(--grad); color: #fff; padding: 11px 20px; border-radius: var(--r-btn); box-shadow: var(--glow); }

.su-toast {
    position: fixed; z-index: 220; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom));
    transform: translate(-50%, 200%); background: var(--text); color: var(--bg);
    width: max-content; max-width: calc(100vw - 40px); text-align: center;
    font-family: var(--font-ui); font-weight: 600; font-size: 14px; direction: rtl;
    padding: 12px 20px; border-radius: var(--r-btn); box-shadow: var(--shadow-pop);
    transition: transform .4s cubic-bezier(.34,1.4,.64,1);
}
.su-toast.show { transform: translate(-50%, 0); }

/* sticky compact header inside the sheet */
.su-sheet { padding-top: 0; max-height: calc(92dvh / var(--ts)); }
.su-top {
    position: sticky; top: 0; z-index: 3; margin: 0 -20px; padding: 10px 20px 8px;
    background: var(--bg); transition: box-shadow .2s, background-color .35s;
}
.su-top.scrolled { background: var(--topbar); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 1px 0 var(--border); }
.su-top .su-grip { margin-bottom: 8px; }
.su-bar { display: flex; align-items: center; position: relative; min-height: 40px; }
.su-compact { position: absolute; left: 50%; transform: translateX(-50%); font-size: 17px; font-weight: 700; opacity: 0; white-space: nowrap; pointer-events: none; }
.su-head { margin-top: 4px; }
.su-x[hidden] { display: none; }

/* text size + UI style option cards */
.su-opts { display: grid; gap: 10px; padding: 12px; }
.su-opts.four { grid-template-columns: repeat(4, 1fr); }
.su-opts.three { grid-template-columns: repeat(3, 1fr); }
.su-opt {
    border: 1.5px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer;
    border-radius: max(6px, calc(var(--r-card) - 8px)); padding: 12px 4px 10px; font-family: inherit;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; min-height: 78px;
    transition: border-color .2s, color .2s, background-color .2s, transform .18s cubic-bezier(.34,1.56,.64,1);
}
.su-opt:active { transform: scale(.95); }
.su-opt .aa { font-weight: 700; line-height: 1; }
.su-opt small { font-size: 11.5px; color: var(--muted); font-weight: 500; }
.su-opt[aria-checked="true"] { border-color: var(--accent); color: var(--accent-deep); background: var(--accent-soft); }
.su-opt[aria-checked="true"] small { color: var(--accent-deep); font-weight: 700; }
.su-thumb { width: 56px; height: 38px; background: var(--raised); border: 1px solid var(--border); display: flex; align-items: flex-end; padding: 6px; }
.su-thumb i { display: block; height: 9px; width: 70%; background: var(--faint); transition: background-color .2s; }
.su-opt[aria-checked="true"] .su-thumb i { background: var(--accent); }

/* lists, review, buttons */
.su-list .su-row { position: relative; }
.su-list .su-row + .su-row::before { content: ''; position: absolute; top: 0; left: 16px; right: 68px; height: 1px; background: var(--border); }
.su-txt small s { color: var(--faint); }
.su-txt small em { font-style: normal; color: var(--accent-deep); font-weight: 700; }
.su-primary, .su-secondary {
    display: block; width: 100%; border: 0; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 16px;
    padding: 15px; border-radius: var(--r-btn); margin-top: 18px;
}
.su-primary { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.su-secondary { background: none; color: var(--muted); margin-top: 6px; }
.su-panel[hidden] { display: none; }
.su-panel { animation: suRise .3s cubic-bezier(.22,1,.36,1) both; }

/* staggered entrance */
@keyframes suRise { from { opacity: 0; transform: translateY(12px); } }
.su-stagger > * { animation: suRise .32s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i, 0) * 45ms); }

@media (prefers-reduced-motion: reduce) {
    .su-sheet, .su-pending, .su-toast, .su-daynight .thumb, .su-sw svg { transition: none; }
    .su-stagger > * { animation: none; }
}
`;

/* ---------------------------------------------------------------------------
   app layer — the customer and business apps
   --------------------------------------------------------------------------- */
const APP_CSS = `
html { background: var(--bg-edge); }
body { background: var(--bg-edge); font-family: var(--font-ui); letter-spacing: 0; }
button, input, select, textarea { font-family: var(--font-ui); }
#app { background: var(--bg); box-shadow: var(--shadow-pop); transition: background-color .35s; height: calc(100dvh / var(--ts)); min-height: 0; }
@media (max-width: 480px) { #app { border-radius: 0; box-shadow: none; } }
.tap:active { transform: scale(.95); filter: none; }

/* UI style reaches the base rules that hard-code their radius */
#app { border-radius: var(--r-card-lg); }
.wbtn, .fchip, .chip, .bc-chip, .sit-chip, .holds-pill, .live-toggle, .btn, .empty .btn,
.modal-btns button, .reply-row input, .reply-row button, .t-chip, .s-chip, .c-fit, .pill { border-radius: var(--r-chip); }
.when { border-radius: calc(var(--r-chip) + 4px); }
.card, .swipe-card { border-radius: var(--r-card-lg); }
.inq-actions button, .detail-cta button, .alt-box .send, .alt-box select, .reasons button, .bc-on .acts button { border-radius: var(--r-field); }
.bc-stat, .booking, .hold, .hold .thumb, .pic, .brand .avatar { border-radius: var(--r-tile); }
.photo .cover-tag, .navbadge { border-radius: var(--r-chip); }
.appbar .btn.icon { border-radius: 50%; }

/* ======================= large title -> compact title ======================= */
.lt { padding: 6px 4px 18px; }
.lt h1 { font-family: var(--font-display); font-weight: 800; font-size: 32px; letter-spacing: -.7px; line-height: 1.12; }
.lt p { font-size: 14.5px; color: var(--muted); margin-top: 4px; }
.lt h1, .lt p, .live-pill, .pick h1, .pick .sub { will-change: opacity, transform; }
.lt .live-toggle { display: inline-flex; margin-top: 12px; cursor: default; }
.appbar { min-height: 64px; border-bottom-color: transparent; transition: border-color .2s, background-color .35s; }
.appbar.scrolled { border-bottom-color: var(--border); }
.appbar-title {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 17px; font-weight: 700; opacity: 0; pointer-events: none; white-space: nowrap;
}
.appbar .brand .avatar { width: 40px; height: 40px; font-size: 17px; }

/* ======================= view entrance: stagger on push ======================= */
@keyframes suEnter { from { opacity: 0; transform: translateY(12px); } }
.views, .view { min-width: 0; }
.view.enter :is(.scroll, .bc-scroll, .editor) > * { animation: suEnter .3s cubic-bezier(.22,1,.36,1) both; }
.view.enter :is(.scroll, .bc-scroll, .editor) > :nth-child(2) { animation-delay: 40ms; }
.view.enter :is(.scroll, .bc-scroll, .editor) > :nth-child(3) { animation-delay: 80ms; }
.view.enter :is(.scroll, .bc-scroll, .editor) > :nth-child(4) { animation-delay: 120ms; }
.view.enter :is(.scroll, .bc-scroll, .editor) > :nth-child(n+5) { animation-delay: 160ms; }

/* ======================= profile header ======================= */
.ph { text-align: center; padding: 10px 0 4px; }
.ph-avatar { position: relative; width: 112px; height: 112px; margin: 0 auto 12px; }
.ph-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.ph-ring circle { fill: none; stroke-width: 4; }
.ph-ring .trk { stroke: var(--border); }
.ph-ring .arc {
    stroke: var(--accent); stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100;
    transition: stroke-dashoffset .8s cubic-bezier(.33,1,.68,1), stroke .25s;
}
.ph-face {
    position: absolute; inset: 11px; border-radius: 50%; display: grid; place-items: center;
    background: var(--grad); color: #fff; font-size: 38px; font-weight: 800; box-shadow: var(--glow);
}
.ph-badge {
    position: absolute; bottom: 6px; left: 6px; width: 30px; height: 30px; border-radius: 50%;
    display: grid; place-items: center; background: var(--accent); color: #fff;
    border: 3px solid var(--bg); transform: scale(0); transition: transform .25s cubic-bezier(.34,1.56,.64,1);
}
.ph-badge svg { width: 14px; height: 14px; }
.ph-badge.show { transform: scale(1); }
.ph h1 { font-size: 26px; }
.ph p { margin-top: 2px; }
.ph-stats {
    display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 18px; text-align: center;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); box-shadow: var(--shadow-card);
}
.ph-stats div { padding: 14px 6px; }
.ph-stats div + div { border-inline-start: 1px solid var(--border); }
.ph-stats b { display: block; font-size: 22px; font-weight: 800; color: var(--accent-deep); font-variant-numeric: tabular-nums; }
.ph-stats span { display: block; font-size: 12px; color: var(--muted); }
.su-pending.above-nav { bottom: calc(84px + env(safe-area-inset-bottom)); }
body.su-sheet-open .su-pending.above-nav { transform: translate(-50%, 260%); }
.editor { padding-bottom: 120px; }

/* ======================= disable by dimming, not hiding ======================= */
.day .day-times, .live-detail { transition: opacity .2s; }
.day.closed .day-times { display: flex; opacity: .4; pointer-events: none; }
.day.closed .day-closed-tag { display: none; }
.live-card.off { opacity: 1; }
.live-card.off .live-detail { display: flex; opacity: .4; pointer-events: none; }

/* checkbox toggle: the thumb carries a check when on */
.switch::after { transition: transform .22s cubic-bezier(.34,1.56,.64,1), background-color .2s; }
.switch[aria-checked="true"]::after {
    background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237A6A62' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / 62% no-repeat;
}

/* ======================= customer: situation picker ======================= */
.pick { padding: 0 20px 28px; position: relative; isolation: isolate; }
.pick::before {                      /* warm hero wash */
    content: ''; position: absolute; z-index: -1; inset: 0 0 auto 0; height: 380px;
    background:
        radial-gradient(120% 70% at 85% 0%, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 60%),
        radial-gradient(90% 60% at 0% 20%, color-mix(in srgb, var(--accent-hot) 22%, transparent) 0%, transparent 65%),
        linear-gradient(to bottom, transparent 55%, var(--bg));
    transition: background .25s;
}
.pick-top {
    position: sticky; top: 0; z-index: 5; margin: 0 -20px; padding: 14px 20px 10px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid transparent; transition: background-color .2s, border-color .2s;
}
.pick-top.scrolled { background: var(--topbar); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border-bottom-color: var(--border); }
.pick-compact {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 17px; font-weight: 700; opacity: 0; pointer-events: none; white-space: nowrap;
}
.brand-chip {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-card);
    border-radius: var(--r-btn); padding: 8px 15px 8px 13px;
    font-weight: 800; font-size: 16px; color: var(--text); letter-spacing: -.2px;
}
.brand-chip svg { width: 17px; height: 17px; color: var(--accent); }
.live-pill {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 18px;
    background: color-mix(in srgb, var(--surface) 80%, transparent); backdrop-filter: blur(8px);
    border: 1px solid var(--border); border-radius: var(--r-btn); padding: 6px 13px;
    font-size: 13px; font-weight: 600; color: var(--text);
}
.live-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--urgent); animation: suPulse 1.3s ease-in-out infinite; }
.live-pill b { color: var(--accent-deep); font-weight: 800; }
@keyframes suPulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--urgent) 50%, transparent); } 50% { box-shadow: 0 0 0 6px transparent; } }
.pick h1 {
    font-family: var(--font-display); font-weight: 800; font-size: 40px; line-height: 1.08;
    letter-spacing: -1px; margin: 14px 0 10px;
}
.pick h1 em {
    font-style: normal; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.pick .sub { font-size: 15.5px; color: var(--muted); margin-bottom: 0; max-width: 34ch; }
.sec-label {
    display: flex; justify-content: space-between; align-items: baseline;
    margin: 28px 4px 10px; font-size: 12px; font-weight: 600; letter-spacing: 1.2px; color: var(--muted);
}
.sec-label span { letter-spacing: 0; color: var(--accent-deep); font-weight: 700; }
.sit-grid { gap: 12px; }
.sit {
    --h: var(--accent);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card);
    padding: 16px 15px 15px; min-height: 0; gap: 14px; box-shadow: var(--shadow-card);
    color: var(--text); position: relative; overflow: hidden;
    transition: transform .18s cubic-bezier(.34,1.56,.64,1), border-color .2s, background-color .35s, box-shadow .2s;
}
.sit::after {
    content: ''; position: absolute; width: 90px; height: 90px; border-radius: 50%;
    top: -40px; left: -34px; background: color-mix(in srgb, var(--h) 10%, transparent); pointer-events: none;
}
.sit:hover { border-color: color-mix(in srgb, var(--h) 45%, var(--surface)); box-shadow: var(--shadow-pop); }
.sit .ico {
    width: 44px; height: 44px; border-radius: var(--r-tile); display: grid; place-items: center;
    background: color-mix(in srgb, var(--h) 14%, var(--surface)); color: var(--h);
}
:root[data-theme="dark"] .sit .ico { background: color-mix(in srgb, var(--h) 24%, var(--surface)); color: color-mix(in srgb, var(--h) 60%, #fff); }
.sit svg, .sit .ico svg { width: 23px; height: 23px; color: inherit; }
.sit b { font-size: 16px; font-weight: 700; }
.sit span { font-size: 12.5px; color: var(--muted); }
.sit .sit-live {
    position: absolute; top: 14px; left: 14px;
    font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--accent-deep);
    background: var(--accent-soft); padding: 3px 9px; border-radius: var(--r-btn);
}
.sit .sit-live.none { color: var(--faint); background: var(--raised); }
.pick .foot { margin-top: 24px; color: var(--faint); }

/* ======================= customer: live feed ======================= */
.bar { border-bottom: 0; padding: 14px 16px 6px; }
.sit-chip {
    background: var(--accent-soft); border: 0; color: var(--accent-deep);
    font-weight: 700; font-size: 14px; padding: 9px 16px 9px 13px;
}
.holds-pill {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    font-weight: 700; padding: 8px 13px; box-shadow: var(--shadow-card);
}
.holds-pill.hot { background: var(--grad); border-color: transparent; color: #fff; box-shadow: var(--glow); }
.feed-tools { display: flex; align-items: center; gap: 8px; }
.when { background: var(--raised); margin: 8px 16px 10px; padding: 4px; }
.wbtn { font-size: 14px; padding: 10px 6px; color: var(--muted); transition: background-color .2s, color .2s, box-shadow .2s; }
.wbtn[aria-pressed="true"] { background: var(--surface); color: var(--accent-deep); font-weight: 700; box-shadow: 0 2px 8px rgba(60, 20, 5, .10); }

.card { border-radius: var(--r-card-lg); box-shadow: var(--shadow-pop); }
.c-media::after {
    background: linear-gradient(to top, rgba(22, 10, 6, .94) 0%, rgba(22, 10, 6, .45) 46%, rgba(22, 10, 6, 0) 68%);
}
.t-chip { font-weight: 700 !important; padding: 7px 13px; }
.s-chip { background: rgba(255, 255, 255, .2); backdrop-filter: blur(8px); font-weight: 700; padding: 7px 12px; }
.c-body { padding: 20px 20px 22px; }
.c-eyebrow {
    display: inline-block; background: var(--grad); color: #fff; opacity: 1;
    font-size: 11.5px; letter-spacing: .3px; padding: 4px 11px; border-radius: var(--r-btn); margin-bottom: 9px;
}
.c-offer { font-family: var(--font-display); font-weight: 800; font-size: 30px; letter-spacing: -.6px; line-height: 1.12; }
.c-note { font-size: 13.5px; color: rgba(255, 255, 255, .78); margin-top: 5px; }
.c-venue { font-size: 14.5px; font-weight: 700; }
.c-fit { background: rgba(255, 255, 255, .16); backdrop-filter: blur(8px); font-size: 12.5px; padding: 6px 12px; }
.stamp { font-family: var(--font-display); font-weight: 800; border-radius: var(--r-tile); }
.stamp.yes { color: #fff; background: var(--grad); border-color: transparent; }
.stamp.no { color: #fff; border-color: rgba(255,255,255,.85); }

.acts { gap: 22px; padding: 14px 0 20px; }
.act { background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-card); }
.act.no { width: 60px; height: 60px; color: var(--muted); }
.act.info { width: 48px; height: 48px; color: var(--faint); }
.act.yes { width: 76px; height: 76px; background: var(--grad); color: #fff; border: 0; box-shadow: var(--glow); }
.act.yes svg { width: 32px; height: 32px; }

.empty { border-radius: var(--r-card-lg); background: var(--surface); }
.empty svg.big { color: var(--accent); }
.empty h2 { font-family: var(--font-display); font-weight: 800; font-size: 22px; }
.empty .btn { background: var(--grad); box-shadow: var(--glow); padding: 13px 24px; }
.empty .btn.ghost { background: var(--raised); color: var(--text); box-shadow: none; }

.modal-wrap { background: var(--scrim); }
.modal { border-radius: var(--r-card-lg); background: var(--surface); }
.modal .spark { background: var(--grad); color: #fff; box-shadow: var(--glow); width: 68px; height: 68px; }
.modal h2 { font-weight: 800; font-size: 24px; letter-spacing: -.4px; }
.arrive { background: var(--accent-soft); border: 0; border-radius: var(--r-field); }
.arrive .num { color: var(--accent-deep); font-weight: 800; font-size: 36px; }
.modal-btns .primary { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.modal-btns .ghost { background: var(--raised); color: var(--text); }

.tray-wrap { background: var(--scrim); }
.tray { background: var(--bg); border-radius: var(--r-card-lg) var(--r-card-lg) 0 0; }
.tray-head h2 { font-weight: 800; font-size: 22px; }
.hold { background: var(--surface); border-radius: var(--r-card); }

.toast { background: var(--text); color: var(--bg); }
.toast b { color: inherit; }

/* ======================= business: shell ======================= */
.appbar {
    background: var(--topbar); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid transparent; padding: 12px 16px;
}
.appbar.scrolled { border-bottom-color: var(--border); }
.brand .avatar {
    width: 42px; height: 42px; border-radius: var(--r-tile); background: var(--grad); color: #fff;
    font-weight: 800; font-size: 18px; box-shadow: var(--glow);
}
.brand .who b { font-size: 16px; font-weight: 800; }
.brand .who span { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.live-toggle { font-size: 12px; font-weight: 700; padding: 7px 12px; }
.live-toggle.on { background: var(--accent-soft); color: var(--accent-deep); border-color: transparent; }
.live-toggle.on i { background: var(--accent); }
.appbar .btn.icon { width: 40px; height: 40px; padding: 0; justify-content: center; border-radius: 50%; }
.appbar .btn.icon svg { width: 19px; height: 19px; }

.bottomnav {
    background: var(--topbar); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border-top: 1px solid var(--border); padding-top: 8px;
}
.navbtn { color: var(--faint); font-size: 11.5px; transition: color .2s; }
.navbtn svg { position: relative; z-index: 1; }
.navbtn::before {
    content: ''; position: absolute; top: 4px; left: 50%; width: 58px; height: 32px; border-radius: var(--r-btn);
    background: var(--accent-soft); transform: translateX(-50%) scaleX(.4); opacity: 0;
    transition: transform .28s cubic-bezier(.34,1.56,.64,1), opacity .2s;
}
.navbtn.active { color: var(--accent-deep); font-weight: 700; }
.navbtn.active::before { transform: translateX(-50%) scaleX(1); opacity: 1; }
.navbtn span { position: relative; z-index: 1; }
.navbadge { background: var(--urgent); z-index: 2; box-shadow: 0 0 0 2px var(--bg); }
.navdot { z-index: 2; background: var(--accent); }

/* ======================= business: inbox ======================= */
.scroll { padding: 16px 16px 32px; }
.stats { gap: 10px; }
.stat { background: var(--surface); border-radius: var(--r-card); padding: 14px 10px; box-shadow: var(--shadow-card); }
.stat b { font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1.1; }
.stat.accent b { color: var(--accent-deep); }
.stat span { font-size: 12px; }
.today h2 { font-size: 12px; font-weight: 600; letter-spacing: 1.2px; color: var(--muted); margin: 20px 4px 10px; }
.booking { background: var(--grad); color: #fff; border: 0; border-radius: var(--r-card); box-shadow: var(--glow); }
.booking .t { color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 22px; }
.booking .p, .booking .n { color: #fff; }
.booking .n { opacity: .85; }
.fchip { font-size: 13.5px; padding: 9px 16px; font-weight: 600; transition: background-color .2s, color .2s; }
.fchip[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
.fchip .badge { background: var(--urgent); }
.inq { border-radius: var(--r-card); background: var(--surface); }
.pic { border-radius: var(--r-tile); font-weight: 800; }
.inq-id h3 { font-size: 16px; font-weight: 700; }
.pill.pending { background: var(--urgent-soft) !important; color: var(--urgent) !important; }
.pill.approved { background: var(--accent-soft); color: var(--accent-deep); }
.inq-kind svg { color: var(--accent); }
.inq-note { background: var(--raised); border-radius: var(--r-field); }
.inq-actions button { border-radius: var(--r-field); padding: 12px; font-weight: 700; }
.btn-approve { background: var(--grad) !important; color: #fff !important; box-shadow: var(--glow); }
.btn-decline { background: var(--surface); color: var(--muted) !important; }
.btn-alt { background: var(--raised); color: var(--text); }
.alt-box .send, .reply-row button { background: var(--grad); }
.sheet-wrap, .overlay { background: var(--scrim); }
.sheet { background: var(--bg); border-radius: var(--r-card-lg) var(--r-card-lg) 0 0; }
.sheet h2 { font-weight: 800; }
.reasons button { background: var(--surface); border-radius: var(--r-field); }
.detail { background: var(--bg); }
.detail-cta .approve { background: var(--grad); color: #fff; }
.msg.them { background: var(--raised); }
.msg.you { background: var(--accent); color: #fff; }

/* ======================= business: broadcast ======================= */
.bc-scroll { padding: 16px 16px 32px; gap: 16px; }
.bc-card { border-radius: var(--r-card); padding: 20px 18px; background: var(--surface); }
.bc-card h2 { font-weight: 800; font-size: 20px; letter-spacing: -.3px; }
.bc-off .dot { background: var(--faint); }
.bc-off h2 { font-size: 24px; }
.bc-off p b { color: var(--urgent); }
.bc-on { background: var(--grad); box-shadow: var(--glow); }
.bc-on .what { font-weight: 800; font-size: 24px; }
.bc-stat { background: rgba(255, 255, 255, .18); border-radius: var(--r-field); }
.bc-on .acts button.stop { background: #fff; color: color-mix(in srgb, var(--accent) 82%, #000); }
.bc-chip { font-weight: 600; transition: background-color .2s, color .2s; }
.bc-chip[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.bc-step button { background: var(--raised); border: 0; color: var(--text); }
.bc-step .n { font-weight: 800; font-size: 34px; }
.bc-go { background: var(--grad); border-radius: var(--r-btn); box-shadow: var(--glow); font-size: 17px; }
.bc-cell { border-radius: var(--r-tile); }
.bc-cell.c1 { background: var(--raised); }
.bc-cell.c2 { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.bc-cell.c3 { background: color-mix(in srgb, var(--accent) 36%, var(--surface)); }
.bc-cell.c4 { background: color-mix(in srgb, var(--accent) 66%, var(--surface)); color: #fff; }
.bc-cell.c5 { background: var(--accent); color: #fff; }
.bc-cell.dead { background: var(--surface); border-color: var(--urgent); color: var(--urgent); }
.bc-cell.picked { background: var(--urgent); border-color: var(--urgent); color: #fff; }
.bc-roi div b { font-weight: 800; font-size: 26px; color: var(--accent-deep); }

/* ======================= business: profile editor ======================= */
.profile-progress { padding: 14px 18px 4px; }
.progress-track { height: 8px; background: var(--raised); border-radius: 999px; }
.progress-fill { background: var(--grad); }
.progress-label b { color: var(--accent-deep); }
.editor { padding: 16px 16px 44px; gap: 16px; }
.section { border-radius: var(--r-card); padding: 22px 18px; background: var(--surface); }
.section-head { align-items: center; gap: 10px; }
.section-head h2 { font-weight: 800; font-size: 20px; letter-spacing: -.3px; }
.section-head .idx {
    min-width: 30px; height: 30px; border-radius: var(--r-tile); display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent-deep); font-size: 12.5px; font-weight: 800; letter-spacing: 0;
}
.field label { color: var(--muted); font-weight: 600; }
input[type="text"], input[type="tel"], input[type="url"], textarea, select {
    background-color: var(--raised); border: 1.5px solid transparent; border-radius: var(--r-field); color: var(--text);
}
input:focus, textarea:focus, select:focus {
    background-color: var(--surface); border-color: var(--accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}
.chip { background: var(--surface); border-color: var(--border); color: var(--muted); font-weight: 500; transition: background-color .2s, color .2s, border-color .2s; }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent-deep); font-weight: 700; }
.seg { background: var(--raised); border: 0; border-radius: var(--r-field); transition: background-color .2s, color .2s; }
.seg[aria-pressed="true"] { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.dish { background: var(--raised); border-radius: var(--r-field); }
.dish input { background: var(--surface); }
.add-row { background: var(--accent-soft); color: var(--accent-deep); border: 1.5px dashed var(--accent-line); border-radius: var(--r-field); font-weight: 700; }
.add-photo { background: var(--raised); border-color: var(--accent-line); }
.photo { border-radius: var(--r-field); }
.photo .cover-tag { background: var(--grad); color: #fff; }
.switch { background: var(--border); }
.switch[aria-checked="true"] { background: var(--accent); }
.live-card { background: var(--raised); border: 0; border-radius: var(--r-card); }
.btn { font-weight: 700; }
.btn.ghost { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
.btn.save { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.preview-hdr span { color: rgba(255,255,255,.85); }
.swipe-card { border-radius: 28px; }
.swipe-live { background: var(--surface) !important; color: var(--text) !important; }
.swipe-live i { background: var(--urgent); }
.circle-btn.nope { background: var(--surface); color: var(--muted); }
.circle-btn.like { background: var(--grad); box-shadow: var(--glow); }
.swipe-dish span:last-child, .dish-price { color: var(--accent-deep) !important; }
.day-closed-tag { color: var(--urgent); }
`;

/* ---------------------------------------------------------------------------
   concept memo: its own token names, mapped onto the new palette.
   Triple :root out-ranks the memo's own light/dark/system blocks.
   --------------------------------------------------------------------------- */
const CONCEPT_CSS = `
:root:root:root {
    --paper: var(--bg);
    --card: var(--surface);
    --card-2: var(--raised);
    --line: var(--border);
    --ink: var(--text);
    --ink-soft: var(--muted);
    --ink-faint: var(--faint);
    --clay: var(--accent);
    --clay-deep: var(--accent-deep);
    --clay-tint: var(--accent-soft);
    --sage: var(--accent-deep);
    --sage-tint: var(--accent-soft);
    --honey: var(--urgent);
    --honey-tint: var(--urgent-soft);
    --rose: var(--urgent);
    --rose-tint: var(--urgent-soft);
    --shadow: var(--shadow-card);
    --font-display: 'Rubik', 'Heebo', system-ui, sans-serif;
    --font-ui: 'Rubik', 'Heebo', system-ui, sans-serif;
}
body { background: var(--bg); }
h1, h2, h3 { letter-spacing: -.4px; }
h1 { font-weight: 800; }
`;

/* ---------------------------------------------------------------------------
   behaviour: theme boot (in <head>, no flash) + the sheet (end of page)
   --------------------------------------------------------------------------- */
const BOOT = `<script>
(function () {
    try {
        var s = JSON.parse(localStorage.getItem('taimli-look') || '{}');
        var dark = s.mode ? s.mode === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        var r = document.documentElement;
        r.setAttribute('data-theme', dark ? 'dark' : 'light');
        if (s.accent) r.style.setProperty('--accent', s.accent);
        if (s.ts) r.style.setProperty('--ts', s.ts);
        if (s.ui && s.ui !== 'rounded') r.setAttribute('data-ui', s.ui);
    } catch (e) {}
})();
</script>`;

const SHEET_JS = `<script>
(function () {
    var KEY = 'taimli-look';
    var ACCENTS = [
        { hex: '#E64A19', name: 'פפריקה' },
        { hex: '#D81B60', name: 'פטל' },
        { hex: '#0E8A5F', name: 'בזיליקום' },
        { hex: '#7B3FE4', name: 'חציל' },
        { hex: '#2F5BEA', name: 'אוכמניות' }
    ];
    var SIZES = [
        { v: 0.9, name: 'קטן', px: 12 }, { v: 1, name: 'רגיל', px: 15 },
        { v: 1.12, name: 'גדול', px: 18 }, { v: 1.25, name: 'ענק', px: 21 }
    ];
    var STYLES = [
        { v: 'rounded', name: 'מעוגל', r: 12 }, { v: 'soft', name: 'רך', r: 7 }, { v: 'crisp', name: 'חד', r: 2 }
    ];
    var FIELDS = { mode: 'מצב תצוגה', accent: 'צבע הטעם', ts: 'גודל טקסט', ui: 'סגנון' };
    var root = document.documentElement;
    var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

    function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
    function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
    function effective(s) {
        return {
            mode: s.mode || (mq && mq.matches ? 'dark' : 'light'),
            accent: (s.accent || ACCENTS[0].hex).toUpperCase(),
            ts: +s.ts || 1,
            ui: s.ui || 'rounded'
        };
    }
    function copy(v) { return { mode: v.mode, accent: v.accent, ts: v.ts, ui: v.ui }; }
    function pick(list, key, v) { for (var i = 0; i < list.length; i++) if (String(list[i][key]).toUpperCase() === String(v).toUpperCase()) return list[i]; return list[0]; }
    function label(k, v) {
        if (k === 'mode') return v === 'dark' ? 'כהה' : 'בהיר';
        if (k === 'accent') return pick(ACCENTS, 'hex', v).name;
        if (k === 'ts') return pick(SIZES, 'v', v).name;
        return pick(STYLES, 'v', v).name;
    }
    function apply(v) {
        root.setAttribute('data-theme', v.mode);
        root.style.setProperty('--accent', v.accent);
        root.style.setProperty('--ts', v.ts);
        if (v.ui === 'rounded') root.removeAttribute('data-ui'); else root.setAttribute('data-ui', v.ui);
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', v.mode === 'dark' ? '#140E0C' : '#FFF7F2');
    }

    var saved = effective(read());
    var draft = copy(saved);
    apply(saved);
    if (mq && mq.addEventListener) mq.addEventListener('change', function () {
        if (read().mode) return;
        saved.mode = effective(read()).mode; draft.mode = saved.mode; apply(draft); sync();
    });

    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    var DROP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/></svg>';
    var TYPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h11v2M9.5 5v14M7 19h5"/><path d="M14 12v-1h6v1M17 11v8M15.5 19h3"/></svg>';
    var SHAPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="5"/></svg>';
    var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.2" r="1.2" fill="currentColor"/><circle cx="15.2" cy="7.6" r="1.2" fill="currentColor"/></svg>';
    var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    var BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
    var ICONS = { mode: SUN, accent: DROP, ts: TYPE, ui: SHAPE };

    var wrap = document.createElement('div');
    wrap.className = 'su-wrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
        '<div class="su-sheet" role="dialog" aria-modal="true" aria-label="המראה שלך">' +
            '<div class="su-top"><div class="su-grip"></div><div class="su-bar">' +
                '<button class="su-x" type="button" data-su="back" aria-label="חזרה" hidden>' + BACK + '</button>' +
                '<span class="su-compact" data-su="compact">המראה שלך</span>' +
                '<button class="su-x" type="button" data-su="close" aria-label="סגירה" style="margin-inline-start:auto">' + X + '</button>' +
            '</div></div>' +

            '<div class="su-panel" data-su="edit">' +
                '<div class="su-head"><div><h2>המראה שלך</h2><p>שיהיה טעים גם לעיניים.</p></div></div>' +
                '<div class="su-card su-preview" aria-hidden="true">' +
                    '<div class="su-pv-media"></div>' +
                    '<div class="su-pv-body">' +
                        '<span class="su-pv-chip">⏱ 12:40</span>' +
                        '<b>קפה שני על הבית</b><small>בזלת קפה · 4 דק׳ הליכה</small>' +
                        '<div class="su-pv-row"><span class="su-pv-tag">2 מקומות</span><span class="su-pv-cta">תופס!</span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="su-label">מצב תצוגה <span data-su="modeVal"></span></div>' +
                '<div class="su-card"><div class="su-row">' +
                    '<span class="su-tile" data-su="modeIco"></span>' +
                    '<div class="su-txt"><b data-su="modeTitle"></b><small data-su="modeSub"></small></div>' +
                    '<button class="su-daynight" type="button" role="switch" aria-label="מצב כהה" data-su="mode">' +
                        '<span class="stars"><i></i><i></i><i></i></span><i class="thumb"></i></button>' +
                '</div></div>' +
                '<div class="su-label">צבע הטעם <span data-su="accentVal"></span></div>' +
                '<div class="su-card">' +
                    '<div class="su-swatches" role="radiogroup" aria-label="צבע">' +
                        ACCENTS.map(function (a) {
                            return '<button class="su-sw" type="button" role="radio" aria-label="' + a.name + '" data-hex="' + a.hex.toUpperCase() +
                                '" style="background:' + a.hex + ';--sw:' + a.hex + '">' + CHECK + '</button>';
                        }).join('') +
                    '</div>' +
                    '<div class="su-sw-names">' + ACCENTS.map(function (a) { return '<span data-hex="' + a.hex.toUpperCase() + '">' + a.name + '</span>'; }).join('') + '</div>' +
                '</div>' +
                '<div class="su-label">גודל טקסט <span data-su="tsVal"></span></div>' +
                '<div class="su-card su-opts four" role="radiogroup" aria-label="גודל טקסט">' +
                    SIZES.map(function (s) {
                        return '<button class="su-opt" type="button" role="radio" data-ts="' + s.v + '"><span class="aa" style="font-size:' + s.px + 'px">Aa</span><small>' + s.name + '</small></button>';
                    }).join('') +
                '</div>' +
                '<div class="su-label">סגנון <span data-su="uiVal"></span></div>' +
                '<div class="su-card su-opts three" role="radiogroup" aria-label="סגנון">' +
                    STYLES.map(function (s) {
                        return '<button class="su-opt" type="button" role="radio" data-ui="' + s.v + '"><span class="su-thumb" style="border-radius:' + s.r + 'px"><i style="border-radius:' + Math.max(2, s.r / 2) + 'px"></i></span><small>' + s.name + '</small></button>';
                    }).join('') +
                '</div>' +
                '<div class="su-label">חל על</div>' +
                '<div class="su-card"><div class="su-row">' +
                    '<span class="su-tile">' + DROP + '</span>' +
                    '<div class="su-txt"><b>כל המסכים</b><small data-su="summary"></small></div>' +
                '</div></div>' +
            '</div>' +

            '<div class="su-panel" data-su="review" hidden>' +
                '<div class="su-head"><div><h2>החוויה שלך</h2><p>רואים הכול יחד לפני ששומרים.</p></div></div>' +
                '<div class="su-label">השינויים <span data-su="reviewN"></span></div>' +
                '<div class="su-card su-list" data-su="reviewList"></div>' +
                '<button class="su-primary" type="button" data-su="commit">שמירת השינויים</button>' +
                '<button class="su-secondary" type="button" data-su="backBtn">חזרה לעריכה</button>' +
            '</div>' +
        '</div>';

    var bar = document.createElement('div');
    bar.className = 'su-pending';
    bar.innerHTML = '<i class="dot"></i><span class="n" data-su="n"></span>' +
        '<button class="discard" type="button">ביטול</button><button class="review" type="button">סקירה</button>';

    var toast = document.createElement('div');
    toast.className = 'su-toast';

    document.body.appendChild(wrap);
    document.body.appendChild(bar);
    document.body.appendChild(toast);

    var sheet = wrap.querySelector('.su-sheet');
    var top = wrap.querySelector('.su-top');
    function q(k) { return wrap.querySelector('[data-su="' + k + '"]'); }
    function changed() { return Object.keys(FIELDS).filter(function (k) { return String(draft[k]) !== String(saved[k]); }); }
    function countText(n) { return n === 1 ? 'שינוי אחד' : n + ' שינויים'; }
    var reviewing = false;

    function radios(sel, attr, val) {
        Array.prototype.forEach.call(wrap.querySelectorAll(sel), function (b) {
            b.setAttribute('aria-checked', String(b.getAttribute(attr)).toUpperCase() === String(val).toUpperCase() ? 'true' : 'false');
        });
    }
    function sync() {
        var dark = draft.mode === 'dark';
        q('mode').setAttribute('aria-checked', dark ? 'true' : 'false');
        q('modeIco').innerHTML = dark ? MOON : SUN;
        q('modeTitle').textContent = dark ? 'מצב כהה' : 'מצב בהיר';
        q('modeSub').textContent = dark ? 'הקישו בשביל אור יום' : 'הקישו כדי להחשיך';
        q('modeVal').textContent = label('mode', draft.mode);
        q('accentVal').textContent = label('accent', draft.accent);
        q('tsVal').textContent = label('ts', draft.ts);
        q('uiVal').textContent = label('ui', draft.ui);
        q('summary').textContent = [label('accent', draft.accent), 'טקסט ' + label('ts', draft.ts), label('ui', draft.ui)].join(' · ');
        radios('.su-sw', 'data-hex', draft.accent);
        radios('[data-ts]', 'data-ts', draft.ts);
        radios('.su-opt[data-ui]', 'data-ui', draft.ui);
        Array.prototype.forEach.call(wrap.querySelectorAll('.su-sw-names span'), function (s) {
            s.classList.toggle('on', s.getAttribute('data-hex') === draft.accent);
        });
        var n = changed().length;
        bar.querySelector('[data-su="n"]').textContent = countText(n);
        bar.classList.toggle('show', n > 0 && wrap.classList.contains('show') && !reviewing);
        if (!n && reviewing) panel(false);
    }
    function setDraft(k, v) {
        draft[k] = v;
        var go = function () { apply(draft); sync(); };
        if (k === 'mode' && document.startViewTransition) document.startViewTransition(go); else go();
    }
    function flash(t) {
        toast.textContent = t; toast.classList.add('show');
        clearTimeout(flash.t); flash.t = setTimeout(function () { toast.classList.remove('show'); }, 1800);
    }
    function onScroll() {
        var k = Math.max(0, Math.min(1, sheet.scrollTop / 60));
        Array.prototype.forEach.call(wrap.querySelectorAll('.su-panel:not([hidden]) .su-head'), function (h) {
            h.style.opacity = 1 - k; h.style.transform = 'translateY(' + (-6 * k) + 'px)';
        });
        q('compact').style.opacity = k;
        top.classList.toggle('scrolled', k > 0.02);
    }
    function panel(review) {
        reviewing = review;
        q('edit').hidden = review; q('review').hidden = !review;
        q('back').hidden = !review;
        q('compact').textContent = review ? 'החוויה שלך' : 'המראה שלך';
        if (review) {
            var list = changed();
            q('reviewN').textContent = countText(list.length);
            q('reviewList').innerHTML = list.map(function (k) {
                return '<div class="su-row"><span class="su-tile">' + ICONS[k] + '</span><div class="su-txt"><b>' + FIELDS[k] + '</b>' +
                    '<small><s>' + label(k, saved[k]) + '</s> ← <em>' + label(k, draft[k]) + '</em></small></div></div>';
            }).join('');
        }
        sheet.scrollTop = 0; onScroll(); sync();
    }
    function open() {
        document.body.classList.add('su-sheet-open');
        wrap.classList.add('show'); wrap.setAttribute('aria-hidden', 'false'); panel(false);
    }
    function discard() { draft = copy(saved); apply(saved); sync(); }
    function hide() {
        wrap.classList.remove('show'); wrap.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('su-sheet-open'); bar.classList.remove('show');
    }
    function close() { if (changed().length) discard(); hide(); }
    function commit() {
        saved = copy(draft);
        write(saved);
        hide(); reviewing = false; sync();
        flash('המראה נשמר · ' + label('accent', saved.accent));
    }

    sheet.addEventListener('scroll', onScroll, { passive: true });
    q('mode').addEventListener('click', function () { setDraft('mode', draft.mode === 'dark' ? 'light' : 'dark'); });
    Array.prototype.forEach.call(wrap.querySelectorAll('.su-sw'), function (b) {
        b.addEventListener('click', function () { setDraft('accent', b.getAttribute('data-hex')); });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-ts]'), function (b) {
        b.addEventListener('click', function () { setDraft('ts', +b.getAttribute('data-ts')); });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.su-opt[data-ui]'), function (b) {
        b.addEventListener('click', function () { setDraft('ui', b.getAttribute('data-ui')); });
    });
    q('close').addEventListener('click', close);
    q('back').addEventListener('click', function () { panel(false); });
    q('backBtn').addEventListener('click', function () { panel(false); });
    q('commit').addEventListener('click', commit);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    bar.querySelector('.discard').addEventListener('click', discard);
    bar.querySelector('.review').addEventListener('click', function () { panel(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('show')) close(); });

    var triggers = document.querySelectorAll('[data-su-open]');
    if (!triggers.length) {
        var f = document.createElement('button');
        f.type = 'button'; f.className = 'su-open su-float'; f.setAttribute('data-su-open', '');
        document.body.appendChild(f);
        triggers = [f];
    }
    Array.prototype.forEach.call(triggers, function (t) {
        if (!t.innerHTML.trim()) t.innerHTML = PALETTE;
        t.setAttribute('aria-label', 'המראה שלך');
        t.addEventListener('click', open);
    });
    sync();
})();
</script>`;

/* ---------------------------------------------------------------------------
   apply
   --------------------------------------------------------------------------- */
function block(tag, body, html = false) {
    return html ? `<!--SUPER:${tag}-->\n${body}\n<!--/SUPER:${tag}-->` : `/* SUPER:${tag} */\n${body}\n/* /SUPER:${tag} */`;
}
function strip(t) {
    return t
        .replace(/\n?\/\* SUPER:(\w+) \*\/[\s\S]*?\/\* \/SUPER:\1 \*\/\n?/g, '\n')
        .replace(/\n?<!--SUPER:(\w+)-->[\s\S]*?<!--\/SUPER:\1-->\n?/g, '\n');
}

for (const { file, kind } of PAGES) {
    let t = strip(fs.readFileSync(file, 'utf8'));

    // font: swap the first Google Fonts stylesheet for Rubik
    t = t.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" \/>/, FONT_LINK);

    // theme boot right after the font link, so the mode is set before first paint
    const fi = t.indexOf(FONT_LINK);
    if (fi < 0) throw new Error(`${file}: font link not found`);
    t = t.slice(0, fi + FONT_LINK.length) + '\n' + block('boot', BOOT, true) + t.slice(fi + FONT_LINK.length);

    // styles at the end of the first stylesheet, so they win the cascade
    const css = TOKENS + SHEET_CSS + (kind === 'app' ? APP_CSS : kind === 'concept' ? CONCEPT_CSS : '');
    const si = t.indexOf('</style>');
    if (si < 0) throw new Error(`${file}: no </style>`);
    t = t.slice(0, si).replace(/\s+$/, '\n') + '\n' + block('style', css) + '\n' + t.slice(si);

    // sheet behaviour at the very end (before </body> when the page has one)
    const bi = t.lastIndexOf('</body>');
    const js = block('sheet', SHEET_JS, true);
    t = bi >= 0 ? t.slice(0, bi).replace(/\s+$/, '\n') + js + '\n' + t.slice(bi) : t.replace(/\s+$/, '\n') + js + '\n';

    fs.writeFileSync(file, t.replace(/\n{3,}/g, '\n\n'));
    console.log(`super: ${file}`);
}
