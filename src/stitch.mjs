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
const restoreHook = `
    /* merged app: lets the staged-changes bar roll the editor back to the published profile */
    window.__editorRestore = function (s) {
        state = JSON.parse(JSON.stringify(s));
        document.querySelectorAll('[data-key]').forEach(function (el) {
            var k = el.getAttribute('data-key');
            if (k in state) el.value = state[k] == null ? '' : state[k];
        });
        ['bizTagline', 'bizAbout'].forEach(function (id) { var e = $(id); if (e) e.dispatchEvent(new Event('input')); });
        renderPhotos(); renderTags(); renderPrice(); renderDishes(); renderHours(); renderLive(); sync();
    };
})();`;
if (!edScript.endsWith('})();')) throw new Error('editor script tail anchor not found');
edScript = edScript.slice(0, -'})();'.length).replace(/\s+$/, '\n') + restoreHook.replace(/^\n/, '');

const syncTail = `        persist();\n    }`;
if (!edScript.includes(syncTail)) throw new Error('editor sync() anchor not found');
edScript = edScript.replace(syncTail,
  `        persist();\n        try { window.dispatchEvent(new CustomEvent('bis-live', { detail: { on: state.liveOn, seats: state.liveSeats, until: state.liveUntil } })); } catch (e) {}\n    }`);

const LIVE_PILL = '<div class="live-toggle on js-live"><i></i><span>משדר · 4 מקומות</span></div>';
function largeTitle(src, name, openTag, html) {
    if (!src.includes(openTag)) throw new Error(name + ': scroller anchor not found');
    return src.replace(openTag, openTag + '\n' + html);
}
const ibScrollT = largeTitle(ibScroll, 'inbox', '<div class="scroll" id="scroll">',
    `    <header class="lt"><h1>פניות</h1><p>בזלת קפה · מי רוצה לשבת אצלכם היום.</p>${LIVE_PILL}</header>`);
const bdContentT = largeTitle(bdContent, 'broadcast', '<div class="bc-scroll" id="bcScroll">',
    `    <header class="lt"><h1>שידור</h1><p>מוכרים את השעות המתות — בלחיצה אחת.</p>${LIVE_PILL}</header>`);
const edSectionsT = largeTitle(edSections, 'editor', '<main class="editor" id="editor">', `    <header class="lt ph">
        <div class="ph-avatar">
            <svg class="ph-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="trk" cx="60" cy="60" r="56"/><circle class="arc" id="phArc" cx="60" cy="60" r="56" pathLength="100"/></svg>
            <span class="ph-face">ב</span>
            <i class="ph-badge" id="phBadge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></i>
        </div>
        <h1 id="phName">בזלת קפה</h1>
        <p id="phSub">@bazelet.cafe · בית קפה</p>
        <div class="ph-stats">
            <div><b id="phPct">0%</b><span>מוכן לפרסום</span></div>
            <div><b id="phPhotos">0</b><span>תמונות</span></div>
            <div><b id="phDishes">0</b><span>מנות בתפריט</span></div>
        </div>
        <div class="profile-progress" hidden>
            <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
            <div class="progress-label">הפרופיל <b id="progressPct">0%</b> מוכן</div>
        </div>
    </header>`);

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
        <div class="brand" title="בזלת קפה · (מ)טעים לי לעסקים">
            <div class="avatar">ב</div>
        </div>
        <div class="appbar-title" id="appbarTitle" aria-hidden="true">פניות</div>
        <div class="appbar-slot">
            <div data-slot="profile" hidden>
                <button class="btn ghost icon tap" id="previewBtn" type="button" aria-label="תצוגה מקדימה" title="תצוגה מקדימה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
                <button class="btn save tap" id="saveBtn" type="button" hidden>שמירה</button>
            </div>
            <button class="su-open tap" type="button" data-su-open></button>
        </div>
    </header>

    <div class="views">
        <section class="view active" id="viewInbox">
${ibScrollT.split('\n').map(l => '        ' + l).join('\n')}
        </section>

        <section class="view" id="viewBroadcast">
${bdContentT.split('\n').map(l => '        ' + l).join('\n')}
        </section>

        <section class="view" id="viewProfile">
${edSectionsT.split('\n').map(l => '        ' + l).join('\n')}
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

<div class="su-pending above-nav" id="profBar">
    <i class="dot"></i><span class="n" id="profN"></span>
    <button class="discard" id="profDiscard" type="button">ביטול</button>
    <button class="review" id="profReview" type="button">סקירה</button>
</div>

<div class="su-wrap" id="profSheet" aria-hidden="true">
    <div class="su-sheet" role="dialog" aria-modal="true" aria-label="לפני שמפרסמים">
        <div class="su-grip"></div>
        <div class="su-head"><div><h2>לפני שמפרסמים</h2><p>כל מה שהשתנה בפרופיל — במקום אחד.</p></div>
            <button class="su-x" id="profClose" type="button" aria-label="סגירה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <div class="su-label">השינויים <span id="profCount"></span></div>
        <div class="su-card su-list" id="profList"></div>
        <button class="su-primary" id="profPublish" type="button">פרסום השינויים</button>
        <button class="su-secondary" id="profBack" type="button">חזרה לעריכה</button>
    </div>
</div>

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
    var TITLES = { inbox: 'פניות', broadcast: 'שידור', profile: 'הפרופיל' };
    var scrollers = {
        inbox: document.getElementById('scroll'),
        broadcast: document.getElementById('bcScroll'),
        profile: document.getElementById('editor')
    };
    var appbar = document.querySelector('.appbar');
    var appTitle = document.getElementById('appbarTitle');
    var current = 'inbox';

    /* large title -> compact title, tied to the first 60px of scroll */
    function onScroll() {
        var s = scrollers[current]; if (!s) return;
        var k = Math.max(0, Math.min(1, s.scrollTop / 60));
        var lt = views[current].querySelector('.lt');
        if (lt) Array.prototype.forEach.call(lt.querySelectorAll('h1, p'), function (el) {
            el.style.opacity = 1 - k; el.style.transform = 'translateY(' + (-6 * k) + 'px)';
        });
        appTitle.style.opacity = k;
        appbar.classList.toggle('scrolled', k > 0.02);
    }
    Object.keys(scrollers).forEach(function (k) {
        if (scrollers[k]) scrollers[k].addEventListener('scroll', function () { if (k === current) onScroll(); }, { passive: true });
    });

    function show(v) {
        current = v;
        appTitle.textContent = TITLES[v];
        Object.keys(views).forEach(function (k) {
            var on = k === v, el = views[k];
            el.classList.toggle('active', on);
            if (on) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
        });
        Array.prototype.forEach.call(btns, function (b) { b.classList.toggle('active', b.getAttribute('data-view') === v); });
        Array.prototype.forEach.call(slots, function (s) {
            s.hidden = s.getAttribute('data-slot').split(' ').indexOf(v) === -1;
        });
        onScroll();
        refreshBar();
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
        Array.prototype.forEach.call(document.querySelectorAll('.js-live'), function (t) {
            t.classList.toggle('on', !!d.on);
            t.querySelector('span').textContent = d.on ? ('משדר · ' + (d.seats || '0') + ' מקומות') : 'שידור כבוי';
        });
        setTimeout(recount, 0);
    });

    /* ---------- staged profile changes ----------
       The editor autosaves its draft; "published" is a separate snapshot that only
       moves when the owner reviews and publishes. The bar counts fields that differ. */
    var DRAFT = 'bis-business-profile-v1', PUB = 'bis-business-profile-published';
    var LABELS = {
        name: 'שם העסק', category: 'קטגוריה', area: 'שכונה', tagline: 'משפט פתיחה', about: 'קצת עלינו',
        photos: 'תמונות', tags: 'תגיות', price: 'רמת מחיר', dishes: 'מנות', hours: 'שעות פתיחה',
        address: 'כתובת', phone: 'טלפון', instagram: 'אינסטגרם', website: 'אתר',
        liveOn: 'שידור מקומות', liveSeats: 'מקומות פנויים', liveUntil: 'שידור עד'
    };
    var PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
    var pub = null, diff = [];
    function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(k, v) {
        if (v == null || v === '') return '—';
        if (k === 'hours') return v.filter(function (h) { return !h.closed; }).length + ' ימים פתוחים';
        if (Array.isArray(v)) return v.length + ' ' + ({ photos: 'תמונות', dishes: 'מנות', tags: 'תגיות' }[k] || 'פריטים');
        if (typeof v === 'boolean') return v ? 'פעיל' : 'כבוי';
        if (typeof v === 'object') return 'עודכן';
        v = String(v); return v.length > 22 ? v.slice(0, 21) + '…' : v;
    }
    function recount() {
        var d = get(DRAFT); if (!d) return;
        if (!pub) { pub = get(PUB); if (!pub) { pub = d; put(PUB, d); } }
        diff = Object.keys(LABELS).filter(function (k) { return JSON.stringify(d[k]) !== JSON.stringify(pub[k]); });
        document.getElementById('profN').textContent = diff.length === 1 ? 'שינוי אחד' : diff.length + ' שינויים';
        refreshBar();
        /* profile header reflects the draft live */
        var pct = parseInt(document.getElementById('progressPct').textContent, 10) || 0;
        document.getElementById('phName').textContent = d.name || 'העסק שלי';
        document.getElementById('phSub').textContent = [d.instagram, d.category].filter(Boolean).join(' · ');
        document.getElementById('phPct').textContent = pct + '%';
        document.getElementById('phPhotos').textContent = (d.photos || []).length;
        document.getElementById('phDishes').textContent = (d.dishes || []).length;
        document.getElementById('phArc').style.strokeDashoffset = 100 - pct;
        document.getElementById('phBadge').classList.toggle('show', pct >= 100);
    }
    var bar = document.getElementById('profBar'), sheet = document.getElementById('profSheet');
    function refreshBar() {
        if (!bar) return;
        bar.classList.toggle('show', current === 'profile' && diff.length > 0 && !sheet.classList.contains('show'));
    }
    function openReview() {
        var d = get(DRAFT) || {};
        document.getElementById('profCount').textContent = diff.length === 1 ? 'שינוי אחד' : diff.length + ' שינויים';
        document.getElementById('profList').innerHTML = diff.map(function (k) {
            return '<div class="su-row"><span class="su-tile">' + PEN + '</span><div class="su-txt"><b>' + LABELS[k] + '</b>' +
                '<small><s>' + esc(fmt(k, pub[k])) + '</s> ← <em>' + esc(fmt(k, d[k])) + '</em></small></div></div>';
        }).join('');
        sheet.classList.add('show'); sheet.setAttribute('aria-hidden', 'false'); refreshBar();
    }
    function closeReview() { sheet.classList.remove('show'); sheet.setAttribute('aria-hidden', 'true'); refreshBar(); }
    document.getElementById('profReview').addEventListener('click', openReview);
    document.getElementById('profClose').addEventListener('click', closeReview);
    document.getElementById('profBack').addEventListener('click', closeReview);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeReview(); });
    document.getElementById('profDiscard').addEventListener('click', function () {
        if (window.__editorRestore && pub) window.__editorRestore(pub);
    });
    document.getElementById('profPublish').addEventListener('click', function () {
        pub = get(DRAFT); put(PUB, pub);
        document.getElementById('saveBtn').click();
        closeReview(); recount();
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
