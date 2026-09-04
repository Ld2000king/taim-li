import fs from 'node:fs';

const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=Miriam+Libre:wght@400;700&display=swap" />';

const TOKENS = `:root {
    /* ---- "נקי" — warm-neutral ground, never cold grey ---- */
    --paper: #FCFBF9;
    --paper-edge: #F2F0EB;
    --card: #FFFFFF;
    --card-2: #F5F3EF;
    --line: #EAE7E1;

    /* ---- ink: every step clears 4.5:1 on white ---- */
    --ink: #14181A;
    --ink-soft: #565D61;
    --ink-faint: #6E7579;

    /* ---- exactly two hues carry the whole app ---- */
    --teal: #0E7C7B;        /* primary · positive · confirmed */
    --teal-deep: #0A6160;
    --teal-tint: #E4F1F0;
    --pink: #D6246E;        /* urgency · expiring · destructive */
    --pink-tint: #FCE7EF;

    /* ---- old role names remapped onto the two hues ---- */
    --sage: var(--teal);
    --sage-tint: var(--teal-tint);
    --clay: var(--teal);
    --clay-deep: var(--teal-deep);
    --clay-tint: var(--teal-tint);
    --honey: var(--pink);
    --honey-tint: var(--pink-tint);
    --plum: var(--ink-soft);       /* tags go neutral — this is most of the de-cluttering */
    --plum-tint: var(--card-2);
    --plum-line: var(--line);
    --rose: var(--pink);
    --rose-tint: var(--pink-tint);

    --shadow-soft: 0 1px 2px rgba(20, 24, 26, .04), 0 8px 24px rgba(20, 24, 26, .06);
    --shadow-lift: 0 2px 6px rgba(20, 24, 26, .05), 0 18px 44px rgba(20, 24, 26, .12);
    --shadow-depth-sm: var(--shadow-soft);
    --shadow-depth-md: var(--shadow-soft);
    --shadow-depth-lg: var(--shadow-lift);
    --glow-green: var(--shadow-soft);
    --glow-gold: var(--shadow-soft);

    --radius-sm: 12px;
    --radius-tile: 16px;
    --radius-btn: 14px;
    --radius-card: 22px;
    --radius-frame: 28px;

    --font-display: 'Miriam Libre', Heebo, Georgia, serif;
    --font-ui: 'Heebo', system-ui, -apple-system, 'Segoe UI', sans-serif;

    --app-max-width: 460px;
}`;

const OVERRIDES = `
/* ============================================================================
   "נקי" pass — structural de-decoration on top of the layout above.
   Fewer filled pills, hairlines instead of heavy borders, one soft shadow.
   ============================================================================ */

/* --- countdowns: a quiet white pill that only turns loud near the end --- */
.t-chip, .card-live, .swipe-live, .inq .stat.pending {
    background: var(--card) !important;
    color: var(--ink) !important;
    box-shadow: 0 1px 3px rgba(20, 24, 26, .12);
    font-weight: 600;
}
.t-chip svg { stroke: var(--pink); color: var(--pink); background: none; }
.card-live i, .swipe-live i { background: var(--pink); }
.t-chip.warn {
    background: var(--pink) !important; color: #fff !important;
}
.t-chip.warn svg { stroke: #fff; }
.t-chip.later { background: var(--card-2) !important; color: var(--ink-soft) !important; box-shadow: none; }

/* --- segmented "when": white pill riding a light track --- */
.when {
    background: var(--card-2);
    border-radius: 999px;
    padding: 4px;
    margin: 11px 16px;
    gap: 4px;
}
.wbtn { background: transparent; border: none; color: var(--ink-soft); font-weight: 500; }
.wbtn[aria-pressed="true"] {
    background: var(--card); color: var(--ink); font-weight: 600;
    box-shadow: 0 1px 3px rgba(20, 24, 26, .10);
}

/* --- chips and tags: neutral, hairline, no colour blocks --- */
.chip, .fchip, .sit-chip, .holds-pill, .live-toggle {
    border-color: var(--line);
    box-shadow: none;
}
.chip[aria-pressed="true"] {
    background: var(--teal-tint); border-color: transparent; color: var(--teal-deep);
}
.fchip[aria-pressed="true"] {
    background: var(--teal-tint); border-color: transparent; color: var(--teal-deep);
}
.d-tags span, .inq-liked span {
    background: var(--card-2); border-color: var(--line); color: var(--ink-soft);
}

/* --- price segments: solid teal, white label --- */
.seg[aria-pressed="true"] {
    background: var(--teal); color: #fff; box-shadow: none;
}

/* --- primary actions --- */
.btn.save, .btn-approve, .detail-cta .approve, .empty .btn, .modal-btns .primary, .sheet-cta .send {
    background: var(--teal); color: #fff; box-shadow: none;
}
.act.yes, .circle-btn.like { background: var(--teal); color: #fff; }
.act.no, .circle-btn.nope { color: var(--ink-soft); }
.act.info { color: var(--ink-faint); }
.act, .circle-btn { box-shadow: var(--shadow-soft); }

/* skipping is not destructive — keep it neutral */
.btn-decline, .sheet-cta .pass { color: var(--ink-soft) !important; }

/* --- cards: one soft shadow, hairline, consistent radius --- */
.section, .inq, .photo, .booking, .stat, .hold, .empty, .live-card, .d-map, .sit {
    box-shadow: var(--shadow-soft);
}
.card, .swipe-card { box-shadow: var(--shadow-lift); }
.booking { background: var(--teal-tint); border-color: transparent; }
.live-card { background: var(--card-2); border-color: var(--line); }
.live-card.off { opacity: .55; }

/* --- status pills --- */
.pill.approved, .inq .stat.ok { background: var(--teal-tint); color: var(--teal-deep); }
.pill.pending { background: var(--pink-tint) !important; color: var(--pink) !important; box-shadow: none; }
.pill.declined { background: var(--card-2); color: var(--ink-faint); }

/* --- photo scrims: neutral, not warm brown --- */
.c-media::after {
    background: linear-gradient(to top, rgba(20, 24, 26, .92) 0%, rgba(20, 24, 26, .40) 46%, rgba(20, 24, 26, 0) 66%);
}
.card-media::after, .swipe-media::after {
    background: linear-gradient(to top, rgba(20, 24, 26, .90) 0%, rgba(20, 24, 26, .34) 44%, rgba(20, 24, 26, 0) 64%);
}
.sheet-hero::after { background: linear-gradient(to top, rgba(20, 24, 26, .46), transparent 34%); }
.c-eyebrow, .swipe-body h3 em, .card-name em, .swipe-meta b, .card-meta b, .toast b { color: #FFFFFF; }
.c-eyebrow { opacity: .82; }
.c-fit svg { color: #fff; stroke: #fff; }
.card-status.open { color: #B7E6D9; }
.card-status.shut { color: #F3C6D8; }

/* --- the offer line is the one place the display face appears --- */
.c-offer, .swipe-body h3, .card-name, .modal h2, .pick h1 { font-family: var(--font-display); font-weight: 700; }

/* --- swipe stamps --- */
.stamp.yes { color: #35C4A8; }
.stamp.no { color: #E8E5DE; }

/* --- hold sheet --- */
.arrive { background: var(--card-2); border-color: var(--line); }
.arrive .num { color: var(--teal-deep); }
.hold .cd { background: var(--teal-tint); color: var(--teal-deep); }
.hold .cd.warn { background: var(--pink-tint); color: var(--pink); }
.hold .cd.dead { background: var(--card-2); color: var(--ink-faint); }
.empty .wait { background: var(--card-2); border-color: var(--line); }
.empty .wait svg { color: var(--ink-soft); }
.empty .wait.on { background: var(--teal-tint); border-color: transparent; }
.empty .wait.on svg { color: var(--teal); }

/* --- business app bits --- */
.progress-fill { background: var(--teal); }
.progress-label b { color: var(--teal-deep); }
.section-head .idx { color: var(--teal); }
.add-row { background: var(--teal-tint); color: var(--teal-deep); border-color: transparent; }
.switch[aria-checked="true"] { background: var(--teal); }
.dish-price, .swipe-dish span:last-child, .d-dish .p { color: var(--teal-deep) !important; }
.dish-remove { background: var(--card-2); color: var(--ink-soft); }
.stat.accent b { color: var(--teal); }
.inq-kind svg { color: var(--teal); }
.inq-state.ok { color: var(--teal); }
.msg.you { background: var(--teal-tint); }
.live-toggle.on { background: var(--teal-tint); border-color: transparent; color: var(--teal-deep); }
.live-toggle.on i { background: var(--teal); }
.day-closed-tag { color: var(--pink); }
.navbtn.active { color: var(--teal-deep); }
.navbadge { background: var(--pink); }
.wordmark { color: var(--teal-deep); }
.brand .avatar { background: var(--teal-tint); color: var(--teal-deep); }
.appbar-slot .live-toggle { cursor: default; }
.sit svg { color: var(--teal); }
.sit:hover { border-color: var(--teal); }
input:focus, textarea:focus, select:focus {
    border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(14, 124, 123, .16);
}
`;

const files = process.argv.slice(2);
if (!files.length) throw new Error('usage: node apply-naki.mjs <file...>');

for (const f of files) {
    let t = fs.readFileSync(f, 'utf8');

    // 1) fonts
    const fontLine = t.split('\n').find((l) => l.includes('fonts.googleapis.com/css2'));
    if (!fontLine) throw new Error(`${f}: font link not found`);
    t = t.replace(fontLine, FONT_LINK);

    // 2) token block — replace the first :root { ... } wholesale
    const start = t.indexOf(':root {');
    if (start < 0) throw new Error(`${f}: :root block not found`);
    const end = t.indexOf('\n}', start);
    if (end < 0) throw new Error(`${f}: :root block not closed`);
    t = t.slice(0, start) + TOKENS + t.slice(end + 2);

    // 2b) customer-avatar hues are baked into JS — harmonise them with the two-hue system
    const oldHues = `    var HUES = {
        maya: '#7C5A82', ron: '#5F9070', dana: '#CB7D55',
        avi: '#4E7FA8', shai: '#B58A2E', tamar: '#9E5C6A', noa: '#5C8A86'
    };`;
    if (t.includes(oldHues)) {
        t = t.replace(oldHues, `    var HUES = {
        maya: '#5B6E8C', ron: '#0E7C7B', dana: '#A8497A',
        avi: '#2F6F63', shai: '#7A6A8E', tamar: '#B0566B', noa: '#4E7C8C'
    };`);
    }

    // 3) append the de-decoration pass at the end of the stylesheet
    const close = t.lastIndexOf('</style>');
    if (close < 0) throw new Error(`${f}: </style> not found`);
    t = t.slice(0, close) + OVERRIDES + '\n' + t.slice(close);

    fs.writeFileSync(f, t);
    console.log('restyled', f);
}
