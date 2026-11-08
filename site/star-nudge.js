(function (root) {
  'use strict';

  var KEY = 'aifs:star-nudge';
  var REPO_URL = 'https://github.com/rohitg00/ai-engineering-from-scratch';
  var DAY = 24 * 60 * 60 * 1000;
  var RULES = {
    activeSeconds: 180,
    sessionGapMs: 30 * 60 * 1000,
    pageSeconds: 20,
    reaskMs: 14 * DAY,
    maxAsks: 2,
    idleMs: 30 * 1000,
    visibleMs: 6000,
  };

  function fresh(now) {
    return { sessions: 1, lastSeen: now, active: 0, asks: 0, lastAsk: 0, done: false };
  }

  function visit(state, now) {
    var next = state ? Object.assign({}, state) : fresh(now);
    if (state && now - state.lastSeen > RULES.sessionGapMs) next.sessions = state.sessions + 1;
    next.lastSeen = now;
    return next;
  }

  function nextAsk(state, now, pageSeconds) {
    if (!state || state.done) return false;
    if (state.asks >= RULES.maxAsks) return false;
    if (pageSeconds < RULES.pageSeconds) return false;
    if (state.asks > 0) return now - state.lastAsk >= RULES.reaskMs;
    return state.active >= RULES.activeSeconds || state.sessions >= 2;
  }

  function asked(state, now) {
    return Object.assign({}, state, { asks: state.asks + 1, lastAsk: now });
  }

  function starred(state) {
    return Object.assign({}, state, { done: true });
  }

  var BUSY = [
    'dialog[open]',
    'body[data-palette-open]',
    '#cmdPalette.cp-open',
    '#modalOverlay.open',
    '.mermaid-modal-overlay.open',
    '#aifsThemeMenu:not([hidden])',
    '.lang-panel:not([hidden])',
    '.header-menu-toggle[aria-expanded="true"]'
  ].join(', ');

  function busyIn(doc) {
    return Boolean(doc.querySelector(BUSY));
  }

  var api = { KEY: KEY, RULES: RULES, BUSY: BUSY, busyIn: busyIn, fresh: fresh, visit: visit, nextAsk: nextAsk, asked: asked, starred: starred };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.AIFSStarNudge = api;

  var doc = root.document;
  if (!doc || doc.documentElement.hasAttribute('data-poster') || doc.querySelector('[data-no-star-nudge]')) return;
  if (/(^|\/)404(\.html)?$/.test(root.location.pathname)) return;

  function read() {
    try {
      var value = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_) {
      return null;
    }
  }
  function write(value) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(value));
    } catch (_) {}
  }

  var state = visit(read(), Date.now());
  write(state);
  if (state.done || state.asks >= RULES.maxAsks) return;

  var still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastInput = Date.now();
  var pageSeconds = 0;
  var showing = false;
  var timer = 0;

  function markStarred() {
    state = starred(read() || state);
    write(state);
    hide();
    root.clearInterval(timer);
  }

  doc.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('.header-github, [data-star-nudge-star]');
    if (link) markStarred();
  }, true);
  ['scroll', 'pointerdown', 'keydown', 'pointermove', 'touchstart'].forEach(function (name) {
    root.addEventListener(name, function () { lastInput = Date.now(); }, { passive: true });
  });

  function busy() {
    return busyIn(doc);
  }

  function anchor() {
    var buttons = doc.querySelectorAll('.header-github');
    for (var i = 0; i < buttons.length; i++) {
      var box = buttons[i].getBoundingClientRect();
      if (box.width > 0 && box.height > 0 && box.bottom > 0) return buttons[i];
    }
    return null;
  }

  var STYLE = [
    '.aifs-star-glow{animation:aifs-star-glow 1.6s cubic-bezier(.23,1,.32,1) 2;border-color:var(--blueprint)!important}',
    '@keyframes aifs-star-glow{0%,100%{box-shadow:0 0 0 0 var(--blueprint-tint-strong)}50%{box-shadow:0 0 0 6px var(--blueprint-tint-strong)}}',
    '.aifs-star-note{position:fixed;z-index:120;width:min(300px,calc(100vw - 24px));padding:12px 14px;border:1px solid var(--blueprint);background:var(--bg);color:var(--ink);box-shadow:3px 3px 0 var(--blueprint-tint-strong);font-family:var(--font-body);font-size:.92rem;line-height:1.45;opacity:0;transform:translateY(-4px);transition:opacity 220ms cubic-bezier(.23,1,.32,1),transform 220ms cubic-bezier(.23,1,.32,1)}',
    '.aifs-star-note[data-on]{opacity:1;transform:none}',
    '.aifs-star-note p{margin:0 0 10px}',
    '.aifs-star-row{display:flex;gap:8px;align-items:center}',
    '.aifs-star-row a,.aifs-star-row button{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;min-height:32px;padding:6px 10px;cursor:pointer}',
    '.aifs-star-row a{background:var(--blueprint);color:#fff;border:1px solid var(--blueprint);text-decoration:none;display:inline-flex;align-items:center}',
    '.aifs-star-row button{background:none;border:1px solid var(--rule-soft);color:var(--ink-soft)}',
    '.aifs-star-row a:focus-visible,.aifs-star-row button:focus-visible{outline:2px solid var(--blueprint);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.aifs-star-glow{animation:none}.aifs-star-note{transform:none;transition:opacity 120ms linear}}',
  ].join('');

  var note = null;
  var closeTimer = 0;
  var holding = false;

  function place(button) {
    var box = button.getBoundingClientRect();
    var width = note.offsetWidth;
    var left = Math.min(Math.max(12, box.right - width), root.innerWidth - width - 12);
    note.style.left = left + 'px';
    note.style.top = Math.round(box.bottom + 10) + 'px';
  }

  function show() {
    var button = anchor();
    if (!button || busy()) return false;
    if (!doc.getElementById('aifs-star-style')) {
      var style = doc.createElement('style');
      style.id = 'aifs-star-style';
      style.textContent = STYLE;
      doc.head.appendChild(style);
    }
    note = doc.createElement('div');
    note.className = 'aifs-star-note';
    note.setAttribute('role', 'status');
    note.innerHTML = '<p>Learning something here? A star helps other engineers find the course.</p>' +
      '<div class="aifs-star-row"><a href="' + REPO_URL + '" target="_blank" rel="noopener" data-star-nudge-star>Star on GitHub</a>' +
      '<button type="button" data-star-nudge-later>Not now</button></div>';
    doc.body.appendChild(note);
    place(button);
    root.requestAnimationFrame(function () {
      if (note) note.setAttribute('data-on', '');
    });
    if (!still) button.classList.add('aifs-star-glow');
    button.addEventListener('animationend', function () { button.classList.remove('aifs-star-glow'); }, { once: true });
    note.querySelector('[data-star-nudge-later]').addEventListener('click', function () { hide(); });
    note.addEventListener('pointerenter', function () { holding = true; root.clearTimeout(closeTimer); });
    note.addEventListener('pointerleave', function () { holding = false; schedule(); });
    note.addEventListener('focusin', function () { holding = true; root.clearTimeout(closeTimer); });
    note.addEventListener('focusout', function () { holding = false; schedule(); });
    root.addEventListener('resize', reposition);
    doc.addEventListener('keydown', onKey);
    showing = true;
    schedule();
    return true;
  }

  function schedule() {
    root.clearTimeout(closeTimer);
    if (!holding) closeTimer = root.setTimeout(function () { hide(); }, RULES.visibleMs);
  }
  function reposition() {
    var button = anchor();
    if (note && button) place(button);
  }
  function onKey(event) {
    if (event.key === 'Escape' && !event.defaultPrevented) hide();
  }

  function hide() {
    if (!showing) return;
    showing = false;
    root.clearTimeout(closeTimer);
    root.removeEventListener('resize', reposition);
    doc.removeEventListener('keydown', onKey);
    var leaving = note;
    note = null;
    if (leaving) {
      leaving.removeAttribute('data-on');
      root.setTimeout(function () { leaving.remove(); }, still ? 130 : 240);
    }
  }

  timer = root.setInterval(function () {
    if (doc.visibilityState !== 'visible') return;
    pageSeconds += 5;
    if (Date.now() - lastInput < RULES.idleMs) {
      state = Object.assign({}, read() || state);
      state.active = (state.active || 0) + 5;
      state.lastSeen = Date.now();
      write(state);
    }
    if (!showing && nextAsk(state, Date.now(), pageSeconds) && show()) {
      state = asked(state, Date.now());
      write(state);
      root.clearInterval(timer);
    }
  }, 5000);
})(typeof window !== 'undefined' ? window : this);
