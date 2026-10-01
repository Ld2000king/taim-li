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

    --r-card: 24px;
    --r-tile: 14px;

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
    --radius-sm: 14px;
    --radius-tile: 18px;
    --radius-btn: 999px;
    --radius-card: var(--r-card);
    --radius-frame: 32px;

    color-scheme: light;
    transition: --accent .25s ease-out;
}
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
    background: var(--bg); border-radius: 30px 30px 0 0;
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
    width: 96px; flex-shrink: 0; border-radius: 18px; background: var(--grad);
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
    padding: 3px 9px; border-radius: 999px; font-variant-numeric: tabular-nums;
}
.su-pv-body b { font-size: 17px; font-weight: 700; margin-top: 4px; }
.su-pv-body small { font-size: 12.5px; color: var(--muted); }
.su-pv-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; }
.su-pv-tag { font-size: 12px; font-weight: 600; color: var(--accent-deep); background: var(--accent-soft); padding: 4px 10px; border-radius: 999px; }
.su-pv-cta { font-size: 13px; font-weight: 700; color: #fff; background: var(--grad); padding: 7px 14px; border-radius: 999px; box-shadow: var(--glow); }

/* settings row */
.su-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 68px; }
.su-tile {
    width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
    display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-deep);
    transition: background-color .25s, color .25s;
}
.su-tile svg { width: 21px; height: 21px; }
.su-txt { flex: 1; min-width: 0; }
.su-txt b { display: block; font-size: 16px; font-weight: 600; }
.su-txt small { display: block; font-size: 13px; color: var(--muted); margin-top: 1px; }

/* sun / moon toggle — light: sun on sky; dark: moon among stars */
.su-daynight {
    position: relative; width: 62px; height: 34px; border-radius: 999px; border: 0; flex-shrink: 0;
    background: #CFE3FF; cursor: pointer; overflow: hidden; transition: background-color .35s ease;
}
.su-daynight::before {           /* cloud */
    content: ''; position: absolute; left: 9px; bottom: 6px; width: 18px; height: 7px; border-radius: 999px;
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
    background: var(--surface); border: 1px solid var(--border); border-radius: 22px;
    box-shadow: 0 8px 30px rgba(40, 14, 4, .16);
    transform: translate(-50%, 180%); transition: transform .3s cubic-bezier(.22,1,.36,1);
    direction: rtl; font-family: var(--font-ui); color: var(--text);
}
.su-pending.show { transform: translate(-50%, 0); }
.su-pending .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.su-pending .n { font-size: 14px; font-weight: 600; flex: 1; }
.su-pending button { border: 0; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 14px; }
.su-pending .discard { background: none; color: var(--muted); padding: 10px 8px; }
.su-pending .review { background: var(--grad); color: #fff; padding: 11px 20px; border-radius: 999px; box-shadow: var(--glow); }

.su-toast {
    position: fixed; z-index: 220; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom));
    transform: translate(-50%, 200%); background: var(--text); color: var(--bg);
    font-family: var(--font-ui); font-weight: 600; font-size: 14px; direction: rtl;
    padding: 12px 20px; border-radius: 999px; box-shadow: var(--shadow-pop);
    transition: transform .4s cubic-bezier(.34,1.4,.64,1);
}
.su-toast.show { transform: translate(-50%, 0); }

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
#app { background: var(--bg); box-shadow: var(--shadow-pop); transition: background-color .35s; }
@media (max-width: 480px) { #app { border-radius: 0; box-shadow: none; } }
.tap:active { transform: scale(.95); filter: none; }

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
.pick-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0 0; }
.brand-chip {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-card);
    border-radius: 999px; padding: 8px 15px 8px 13px;
    font-weight: 800; font-size: 16px; color: var(--text); letter-spacing: -.2px;
}
.brand-chip svg { width: 17px; height: 17px; color: var(--accent); }
.live-pill {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 30px;
    background: color-mix(in srgb, var(--surface) 80%, transparent); backdrop-filter: blur(8px);
    border: 1px solid var(--border); border-radius: 999px; padding: 6px 13px;
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
    background: var(--surface); border: 1px solid var(--border); border-radius: 22px;
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
    width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--h) 14%, var(--surface)); color: var(--h);
}
:root[data-theme="dark"] .sit .ico { background: color-mix(in srgb, var(--h) 24%, var(--surface)); color: color-mix(in srgb, var(--h) 60%, #fff); }
.sit svg, .sit .ico svg { width: 23px; height: 23px; color: inherit; }
.sit b { font-size: 16px; font-weight: 700; }
.sit span { font-size: 12.5px; color: var(--muted); }
.sit .sit-live {
    position: absolute; top: 14px; left: 14px;
    font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--accent-deep);
    background: var(--accent-soft); padding: 3px 9px; border-radius: 999px;
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

.card { border-radius: 30px; box-shadow: var(--shadow-pop); }
.c-media::after {
    background: linear-gradient(to top, rgba(22, 10, 6, .94) 0%, rgba(22, 10, 6, .45) 46%, rgba(22, 10, 6, 0) 68%);
}
.t-chip { font-weight: 700 !important; padding: 7px 13px; }
.s-chip { background: rgba(255, 255, 255, .2); backdrop-filter: blur(8px); font-weight: 700; padding: 7px 12px; }
.c-body { padding: 20px 20px 22px; }
.c-eyebrow {
    display: inline-block; background: var(--grad); color: #fff; opacity: 1;
    font-size: 11.5px; letter-spacing: .3px; padding: 4px 11px; border-radius: 999px; margin-bottom: 9px;
}
.c-offer { font-family: var(--font-display); font-weight: 800; font-size: 30px; letter-spacing: -.6px; line-height: 1.12; }
.c-note { font-size: 13.5px; color: rgba(255, 255, 255, .78); margin-top: 5px; }
.c-venue { font-size: 14.5px; font-weight: 700; }
.c-fit { background: rgba(255, 255, 255, .16); backdrop-filter: blur(8px); font-size: 12.5px; padding: 6px 12px; }
.stamp { font-family: var(--font-display); font-weight: 800; border-radius: 14px; }
.stamp.yes { color: #fff; background: var(--grad); border-color: transparent; }
.stamp.no { color: #fff; border-color: rgba(255,255,255,.85); }

.acts { gap: 22px; padding: 14px 0 20px; }
.act { background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-card); }
.act.no { width: 60px; height: 60px; color: var(--muted); }
.act.info { width: 48px; height: 48px; color: var(--faint); }
.act.yes { width: 76px; height: 76px; background: var(--grad); color: #fff; border: 0; box-shadow: var(--glow); }
.act.yes svg { width: 32px; height: 32px; }

.empty { border-radius: 30px; background: var(--surface); }
.empty svg.big { color: var(--accent); }
.empty h2 { font-family: var(--font-display); font-weight: 800; font-size: 22px; }
.empty .btn { background: var(--grad); box-shadow: var(--glow); padding: 13px 24px; }
.empty .btn.ghost { background: var(--raised); color: var(--text); box-shadow: none; }

.modal-wrap { background: var(--scrim); }
.modal { border-radius: 30px; background: var(--surface); }
.modal .spark { background: var(--grad); color: #fff; box-shadow: var(--glow); width: 68px; height: 68px; }
.modal h2 { font-weight: 800; font-size: 24px; letter-spacing: -.4px; }
.arrive { background: var(--accent-soft); border: 0; border-radius: 18px; }
.arrive .num { color: var(--accent-deep); font-weight: 800; font-size: 36px; }
.modal-btns .primary { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.modal-btns .ghost { background: var(--raised); color: var(--text); }

.tray-wrap { background: var(--scrim); }
.tray { background: var(--bg); border-radius: 30px 30px 0 0; }
.tray-head h2 { font-weight: 800; font-size: 22px; }
.hold { background: var(--surface); border-radius: 20px; }

.toast { background: var(--text); color: var(--bg); }
.toast b { color: inherit; }

/* ======================= business: shell ======================= */
.appbar {
    background: var(--topbar); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--border); padding: 12px 16px;
}
.brand .avatar {
    width: 42px; height: 42px; border-radius: 14px; background: var(--grad); color: #fff;
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
    content: ''; position: absolute; top: 4px; left: 50%; width: 58px; height: 32px; border-radius: 999px;
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
.stat { background: var(--surface); border-radius: 20px; padding: 14px 10px; box-shadow: var(--shadow-card); }
.stat b { font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1.1; }
.stat.accent b { color: var(--accent-deep); }
.stat span { font-size: 12px; }
.today h2 { font-size: 12px; font-weight: 600; letter-spacing: 1.2px; color: var(--muted); margin: 20px 4px 10px; }
.booking { background: var(--grad); color: #fff; border: 0; border-radius: 20px; box-shadow: var(--glow); }
.booking .t { color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 22px; }
.booking .p, .booking .n { color: #fff; }
.booking .n { opacity: .85; }
.fchip { font-size: 13.5px; padding: 9px 16px; font-weight: 600; transition: background-color .2s, color .2s; }
.fchip[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
.fchip .badge { background: var(--urgent); }
.inq { border-radius: 24px; background: var(--surface); }
.pic { border-radius: 15px; font-weight: 800; }
.inq-id h3 { font-size: 16px; font-weight: 700; }
.pill.pending { background: var(--urgent-soft) !important; color: var(--urgent) !important; }
.pill.approved { background: var(--accent-soft); color: var(--accent-deep); }
.inq-kind svg { color: var(--accent); }
.inq-note { background: var(--raised); border-radius: 16px; }
.inq-actions button { border-radius: 16px; padding: 12px; font-weight: 700; }
.btn-approve { background: var(--grad) !important; color: #fff !important; box-shadow: var(--glow); }
.btn-decline { background: var(--surface); color: var(--muted) !important; }
.btn-alt { background: var(--raised); color: var(--text); }
.alt-box .send, .reply-row button { background: var(--grad); }
.sheet-wrap, .overlay { background: var(--scrim); }
.sheet { background: var(--bg); border-radius: 30px 30px 0 0; }
.sheet h2 { font-weight: 800; }
.reasons button { background: var(--surface); border-radius: 16px; }
.detail { background: var(--bg); }
.detail-cta .approve { background: var(--grad); color: #fff; }
.msg.them { background: var(--raised); }
.msg.you { background: var(--accent); color: #fff; }

/* ======================= business: broadcast ======================= */
.bc-scroll { padding: 16px 16px 32px; gap: 16px; }
.bc-card { border-radius: 24px; padding: 20px 18px; background: var(--surface); }
.bc-card h2 { font-weight: 800; font-size: 20px; letter-spacing: -.3px; }
.bc-off .dot { background: var(--faint); }
.bc-off h2 { font-size: 24px; }
.bc-off p b { color: var(--urgent); }
.bc-on { background: var(--grad); box-shadow: var(--glow); }
.bc-on .what { font-weight: 800; font-size: 24px; }
.bc-stat { background: rgba(255, 255, 255, .18); border-radius: 16px; }
.bc-on .acts button.stop { background: #fff; color: color-mix(in srgb, var(--accent) 82%, #000); }
.bc-chip { font-weight: 600; transition: background-color .2s, color .2s; }
.bc-chip[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.bc-step button { background: var(--raised); border: 0; color: var(--text); }
.bc-step .n { font-weight: 800; font-size: 34px; }
.bc-go { background: var(--grad); border-radius: 999px; box-shadow: var(--glow); font-size: 17px; }
.bc-cell { border-radius: 10px; }
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
.progress-track { height: 8px; background: var(--raised); }
.progress-fill { background: var(--grad); }
.progress-label b { color: var(--accent-deep); }
.editor { padding: 16px 16px 44px; gap: 16px; }
.section { border-radius: 24px; padding: 22px 18px; background: var(--surface); }
.section-head { align-items: center; gap: 10px; }
.section-head h2 { font-weight: 800; font-size: 20px; letter-spacing: -.3px; }
.section-head .idx {
    min-width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent-deep); font-size: 12.5px; font-weight: 800; letter-spacing: 0;
}
.field label { color: var(--muted); font-weight: 600; }
input[type="text"], input[type="tel"], input[type="url"], textarea, select {
    background-color: var(--raised); border: 1.5px solid transparent; border-radius: 16px; color: var(--text);
}
input:focus, textarea:focus, select:focus {
    background-color: var(--surface); border-color: var(--accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}
.chip { background: var(--surface); border-color: var(--border); color: var(--muted); font-weight: 500; transition: background-color .2s, color .2s, border-color .2s; }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent-deep); font-weight: 700; }
.seg { background: var(--raised); border: 0; border-radius: 16px; transition: background-color .2s, color .2s; }
.seg[aria-pressed="true"] { background: var(--grad); color: #fff; box-shadow: var(--glow); }
.dish { background: var(--raised); border-radius: 18px; }
.dish input { background: var(--surface); }
.add-row { background: var(--accent-soft); color: var(--accent-deep); border: 1.5px dashed var(--accent-line); border-radius: 16px; font-weight: 700; }
.add-photo { background: var(--raised); border-color: var(--accent-line); }
.photo { border-radius: 18px; }
.photo .cover-tag { background: var(--grad); color: #fff; }
.switch { background: var(--border); }
.switch[aria-checked="true"] { background: var(--accent); }
.live-card { background: var(--raised); border: 0; border-radius: 20px; }
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
    var root = document.documentElement;
    var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

    function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
    function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
    function effective(s) {
        return {
            mode: s.mode || (mq && mq.matches ? 'dark' : 'light'),
            accent: (s.accent || ACCENTS[0].hex).toUpperCase()
        };
    }
    function accentName(hex) {
        for (var i = 0; i < ACCENTS.length; i++) if (ACCENTS[i].hex.toUpperCase() === hex) return ACCENTS[i].name;
        return ACCENTS[0].name;
    }
    function apply(v) {
        root.setAttribute('data-theme', v.mode);
        root.style.setProperty('--accent', v.accent);
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', v.mode === 'dark' ? '#140E0C' : '#FFF7F2');
    }

    var saved = effective(read());
    var draft = { mode: saved.mode, accent: saved.accent };
    apply(saved);
    if (mq && mq.addEventListener) mq.addEventListener('change', function () {
        if (read().mode) return;
        saved = effective(read()); draft = { mode: saved.mode, accent: saved.accent }; apply(saved); sync();
    });

    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    var DROP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/></svg>';
    var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.2" r="1.2" fill="currentColor"/><circle cx="15.2" cy="7.6" r="1.2" fill="currentColor"/></svg>';
    var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

    var wrap = document.createElement('div');
    wrap.className = 'su-wrap'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
        '<div class="su-sheet" role="dialog" aria-modal="true" aria-label="המראה שלך">' +
            '<div class="su-grip"></div>' +
            '<div class="su-head"><div><h2>המראה שלך</h2><p>שיהיה טעים גם לעיניים.</p></div>' +
                '<button class="su-x" type="button" aria-label="סגירה">' + X + '</button></div>' +
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
            '<div class="su-label">מה זה משנה</div>' +
            '<div class="su-card"><div class="su-row">' +
                '<span class="su-tile">' + DROP + '</span>' +
                '<div class="su-txt"><b>בכל המסכים</b><small>צד הלקוח, צד העסק ומסמך המיקוד — יחד.</small></div>' +
            '</div></div>' +
        '</div>';

    var bar = document.createElement('div');
    bar.className = 'su-pending';
    bar.innerHTML = '<i class="dot"></i><span class="n" data-su="n"></span>' +
        '<button class="discard" type="button">ביטול</button><button class="review" type="button">שמירה</button>';

    var toast = document.createElement('div');
    toast.className = 'su-toast';

    document.body.appendChild(wrap);
    document.body.appendChild(bar);
    document.body.appendChild(toast);

    function q(k) { return wrap.querySelector('[data-su="' + k + '"]'); }
    function changes() { return (draft.mode !== saved.mode ? 1 : 0) + (draft.accent !== saved.accent ? 1 : 0); }

    function sync() {
        var dark = draft.mode === 'dark';
        q('mode').setAttribute('aria-checked', dark ? 'true' : 'false');
        q('modeIco').innerHTML = dark ? MOON : SUN;
        q('modeTitle').textContent = dark ? 'מצב כהה' : 'מצב בהיר';
        q('modeSub').textContent = dark ? 'הקישו בשביל אור יום' : 'הקישו כדי להחשיך';
        q('modeVal').textContent = dark ? 'כהה' : 'בהיר';
        q('accentVal').textContent = accentName(draft.accent);
        Array.prototype.forEach.call(wrap.querySelectorAll('.su-sw'), function (b) {
            b.setAttribute('aria-checked', b.getAttribute('data-hex') === draft.accent ? 'true' : 'false');
        });
        Array.prototype.forEach.call(wrap.querySelectorAll('.su-sw-names span'), function (s) {
            s.classList.toggle('on', s.getAttribute('data-hex') === draft.accent);
        });
        var n = changes();
        bar.querySelector('[data-su="n"]').textContent = n === 1 ? 'שינוי אחד' : n + ' שינויים';
        bar.classList.toggle('show', n > 0 && wrap.classList.contains('show'));
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
    function open() { wrap.classList.add('show'); wrap.setAttribute('aria-hidden', 'false'); sync(); }
    function discard() { draft = { mode: saved.mode, accent: saved.accent }; apply(saved); sync(); }
    function close() { if (changes()) discard(); wrap.classList.remove('show'); wrap.setAttribute('aria-hidden', 'true'); sync(); }
    function commit() {
        saved = { mode: draft.mode, accent: draft.accent };
        write({ mode: saved.mode, accent: saved.accent });
        sync(); wrap.classList.remove('show'); wrap.setAttribute('aria-hidden', 'true'); bar.classList.remove('show');
        flash('המראה נשמר · ' + accentName(saved.accent));
    }

    q('mode').addEventListener('click', function () { setDraft('mode', draft.mode === 'dark' ? 'light' : 'dark'); });
    Array.prototype.forEach.call(wrap.querySelectorAll('.su-sw'), function (b) {
        b.addEventListener('click', function () { setDraft('accent', b.getAttribute('data-hex')); });
    });
    wrap.querySelector('.su-x').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    bar.querySelector('.discard').addEventListener('click', discard);
    bar.querySelector('.review').addEventListener('click', commit);
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
