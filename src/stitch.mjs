import fs from 'node:fs';

const ed = fs.readFileSync('bis-business-editor.html', 'utf8');
const ib = fs.readFileSync('bis-business-inbox.html', 'utf8');
const bd = fs.readFileSync('bis-business-broadcast.html', 'utf8');

/* Slice by content anchors, never by line numbers — restyles move lines. */
function between(src, name, startMark, endMark, { includeEnd = true, fromIndex = 0 } = {}) {
    const a = src.indexOf(startMark, fromIndex);
    if (a < 0) throw new Error(`${name}: start anchor not found -> ${startMark}`);
    const b = src.indexOf(endMark, a + startMark.length);
    if (b < 0) throw new Error(`${name}: end anchor not found -> ${endMark}`);
    return src.slice(a, includeEnd ? b + endMark.length : b).replace(/\s+$/, '');
}

const edStyle    = between(ed, 'editor style', '<style>', '</style>', { includeEnd: false }).replace('<style>', '').trim();
const edSections = between(ed, 'editor sections', '<main class="editor" id="editor">', '</main>');
const edOverlay  = between(ed, 'editor overlay', '<div class="overlay" id="overlay">', '<div class="toast" id="toast">', { includeEnd: false });
let   edScript   = between(ed, 'editor script', '(function () {', '})();', { fromIndex: ed.lastIndexOf('<script>') });

const ibStyle    = between(ib, 'inbox style', '<style>', '</style>', { includeEnd: false }).replace('<style>', '').trim();
const ibScroll   = between(ib, 'inbox scroll', '<div class="scroll" id="scroll">', '<div id="list"></div>') + '\n    </div>';
const ibSheets   = between(ib, 'inbox sheets', '<!-- decline reason sheet -->', '<div class="toast" id="toast">', { includeEnd: false });
let   ibScript   = between(ib, 'inbox script', '(function () {', '})();', { fromIndex: ib.lastIndexOf('<script>') });

const bdStyle    = between(bd, 'broadcast style', '<style>', '</style>', { includeEnd: false }).replace('<style>', '').trim();
const bdContent  = between(bd, 'broadcast content', '<div class="bc-scroll" id="bcScroll">', '<!-- /bcScroll -->') + '\n    </div>';
let   bdScript   = between(bd, 'broadcast script', '(function () {', '})();', { fromIndex: bd.lastIndexOf('<script>') });

/* --- broadcast script: light up the nav dot while a broadcast is live --- */
const heroHead = `    function renderHero() {\n        var el = $('#bcHero');`;
if (!bdScript.includes(heroHead)) throw new Error('broadcast renderHero anchor not found');
bdScript = bdScript.replace(heroHead,
  `    function renderHero() {\n        if (window.__setBroadcastLive) window.__setBroadcastLive(!!bc.live);\n        var el = $('#bcHero');`);

/* --- inbox script: drop the standalone live-toggle handler, wire the nav badge --- */
const liveHandler = `    /* ---------- live toggle ---------- */
    $('#liveToggle').addEventListener('click', function () {
        live = !live;
        this.classList.toggle('on', live);
        $('#liveLabel').textContent = live ? 'משדר · 4 מקומות' : 'שידור כבוי';
        flash(live ? 'שידור מקומות פנויים הופעל' : 'הפסקת לשדר מקומות פנויים');
    });`;
if (!ibScript.includes(liveHandler)) throw new Error('inbox live handler anchor not found');
ibScript = ibScript.replace(liveHandler,
  `    /* live pill is display-only in the merged app — source of truth is the profile tab */`);

const renderAllOld = `    function renderAll() { renderStats(); renderToday(); renderFilters(); renderList(); }`;
if (!ibScript.includes(renderAllOld)) throw new Error('inbox renderAll anchor not found');
ibScript = ibScript.replace(renderAllOld,
  `    function renderAll() { renderStats(); renderToday(); renderFilters(); renderList(); if (window.__setInboxBadge) window.__setInboxBadge(pendingCount()); }`);

/* --- editor script: emit shared live state from sync() --- */
const syncTail = `        persist();\n    }`;
if (!edScript.includes(syncTail)) throw new Error('editor sync() anchor not found');
edScript = edScript.replace(syncTail,
  `        persist();\n        try { window.dispatchEvent(new CustomEvent('bis-live', { detail: { on: state.liveOn, seats: state.liveSeats, until: state.liveUntil } })); } catch (e) {}\n    }`);

const shellCss = `
/* ============================================================================
   merged shell — one business app, bottom nav (פניות / הפרופיל)
   ============================================================================ */
.appbar {
    position: relative; z-index: 40;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 12px 16px;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
}
.appbar-slot { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.appbar-slot > [data-slot][hidden] { display: none !important; }

.views { flex: 1; position: relative; min-height: 0; display: flex; }
.view { display: none; flex: 1; min-height: 0; flex-direction: column; }
.view.active { display: flex; }

.profile-progress {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px 2px;
}

.bottomnav {
    flex-shrink: 0;
    display: flex; gap: 4px;
    border-top: 1px solid var(--line);
    background: var(--paper);
    padding: 6px 12px calc(8px + env(safe-area-inset-bottom));
}
.navbtn {
    flex: 1; position: relative;
    background: none; border: none;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 8px 4px; border-radius: 14px;
    color: var(--ink-faint);
    font-family: var(--font-ui); font-weight: 600; font-size: 11px;
}
.navbtn svg { width: 22px; height: 22px; }
.navbtn:active { transform: scale(0.94); }
.navbadge {
    position: absolute; top: 3px; inset-inline-start: calc(50% + 6px);
    color: #fff;
    font-size: 9px; font-weight: 700;
    min-width: 15px; height: 15px; border-radius: 999px; padding: 0 3px;
    display: none; place-items: center;
}
.navbadge.show { display: grid; }
.navdot {
    position: absolute; top: 5px; inset-inline-start: calc(50% + 8px);
    width: 8px; height: 8px; border-radius: 50%; background: var(--teal);
    display: none;
}
.navdot.show { display: block; animation: bcPulse 1.2s ease-in-out infinite; }
`;

const out = `<title>(מ)טעים לי לעסקים</title>
<meta name="description" content="אפליקציית העסק של (מ)טעים לי — פניות מלקוחות ועריכת הפרופיל במקום אחד, עם ניווט תחתון. גרסת דמו." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=Miriam+Libre:wght@400;700&display=swap" />

<style>
${edStyle}

${ibStyle}

${bdStyle}
${shellCss}
</style>

<div id="app" lang="he" dir="rtl">
    <header class="appbar">
        <div class="brand">
            <div class="avatar">ב</div>
            <div class="who">
                <b>בזלת קפה</b>
                <span>לב תל אביב · (מ)טעים לי לעסקים</span>
            </div>
        </div>
        <div class="appbar-slot">
            <div data-slot="inbox broadcast">
                <div class="live-toggle on" id="liveToggle"><i></i><span id="liveLabel">משדר · 4 מקומות</span></div>
            </div>
            <div data-slot="profile" hidden>
                <button class="btn ghost tap" id="previewBtn" type="button">תצוגה מקדימה</button>
                <button class="btn save tap" id="saveBtn" type="button">שמירה</button>
            </div>
        </div>
    </header>

    <div class="views">
        <section class="view active" id="viewInbox">
${ibScroll.split('\n').map(l => '        ' + l).join('\n')}
        </section>

        <section class="view" id="viewBroadcast">
${bdContent.split('\n').map(l => '        ' + l).join('\n')}
        </section>

        <section class="view" id="viewProfile">
            <div class="profile-progress">
                <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
                <div class="progress-label">הפרופיל <b id="progressPct">0%</b> מוכן</div>
            </div>
${edSections.split('\n').map(l => '        ' + l).join('\n')}
        </section>
    </div>

    <nav class="bottomnav">
        <button class="navbtn active" data-view="inbox" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 8l8 5 8-5"/></svg>
            <span>פניות</span><i class="navbadge" id="navBadge">0</i>
        </button>
        <button class="navbtn" data-view="broadcast" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>
            <span>שידור</span><i class="navdot" id="navDot"></i>
        </button>
        <button class="navbtn" data-view="profile" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3.4"/><path d="M5 20c1.3-3.8 4.2-5.6 7-5.6s5.7 1.8 7 5.6"/></svg>
            <span>הפרופיל</span>
        </button>
    </nav>
</div>

${edOverlay}

${ibSheets}

<div class="toast" id="toast"></div>

<script>
(function () {
    var slots = document.querySelectorAll('.appbar-slot [data-slot]');
    var views = {
        inbox: document.getElementById('viewInbox'),
        broadcast: document.getElementById('viewBroadcast'),
        profile: document.getElementById('viewProfile')
    };
    var btns = document.querySelectorAll('.navbtn');
    function show(v) {
        Object.keys(views).forEach(function (k) { views[k].classList.toggle('active', k === v); });
        Array.prototype.forEach.call(btns, function (b) { b.classList.toggle('active', b.getAttribute('data-view') === v); });
        Array.prototype.forEach.call(slots, function (s) {
            s.hidden = s.getAttribute('data-slot').split(' ').indexOf(v) === -1;
        });
    }
    Array.prototype.forEach.call(btns, function (b) {
        b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
    });
    window.__setInboxBadge = function (n) {
        var el = document.getElementById('navBadge');
        el.textContent = n; el.classList.toggle('show', n > 0);
    };
    window.__setBroadcastLive = function (on) {
        var d = document.getElementById('navDot');
        if (d) d.classList.toggle('show', !!on);
    };
    window.addEventListener('bis-live', function (e) {
        var d = e.detail || {};
        var t = document.getElementById('liveToggle');
        if (!t) return;
        t.classList.toggle('on', !!d.on);
        document.getElementById('liveLabel').textContent = d.on
            ? ('משדר · ' + (d.seats || '0') + ' מקומות') : 'שידור כבוי';
    });
    show('inbox');
})();
</script>

<script>
${ibScript}
</script>

<script>
${bdScript}
</script>

<script>
${edScript}
</script>
`;

fs.writeFileSync('bis-business-app.html', out);
console.log('wrote bis-business-app.html', out.length, 'bytes,', out.split('\n').length, 'lines');
