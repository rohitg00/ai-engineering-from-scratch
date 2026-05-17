/**
 * Command palette — global search triggered by Cmd/Ctrl+K or the search button.
 *
 * Searches lesson titles, summaries, phase names, languages, types, and
 * glossary terms entirely client-side from the data already loaded in data.js.
 * No network requests. No external dependencies.
 *
 * API (attached to window.CmdPalette):
 *   CmdPalette.open()   — open the palette
 *   CmdPalette.close()  — close the palette
 *
 * Trigger buttons: any element with the [data-cmd-palette] attribute.
 */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────
  var PALETTE_ID  = 'cmdPalette';
  var MAX_RESULTS = 12;
  var BODY_ATTR   = 'data-palette-open';

  // ── Module state ─────────────────────────────────────────────────────
  var _index      = null;   // lazy-built flat array of searchable items
  var _activeIdx  = -1;
  var _isOpen     = false;
  var _prevFocus  = null;

  // ── Search index ─────────────────────────────────────────────────────
  /**
   * Build the flat search index once from window.PHASES and window.GLOSSARY.
   * Idempotent: subsequent calls return the cached array.
   */
  function buildIndex() {
    if (_index !== null) return _index;
    _index = [];

    if (typeof PHASES !== 'undefined' && Array.isArray(PHASES)) {
      for (var i = 0; i < PHASES.length; i++) {
        var phase = PHASES[i];
        for (var j = 0; j < phase.lessons.length; j++) {
          var lesson = phase.lessons[j];

          // Extract the phases/…/… path used for lesson.html?path=
          var lessonPath = '';
          if (lesson.url) {
            var m = lesson.url.match(/(phases\/[^/?#]+\/[^/?#]+)/);
            if (m) lessonPath = m[1];
          }

          _index.push({
            kind:       'lesson',
            id:         'l:' + i + ':' + j,
            phaseId:    phase.id,
            phaseName:  phase.name,
            name:       lesson.name    || '',
            summary:    lesson.summary || '',
            type:       lesson.type    || '',
            lang:       lesson.lang    || '',
            status:     lesson.status  || '',
            lessonPath: lessonPath,
            url:        lesson.url     || '',
          });
        }
      }
    }

    if (typeof GLOSSARY !== 'undefined' && Array.isArray(GLOSSARY)) {
      for (var k = 0; k < GLOSSARY.length; k++) {
        var g = GLOSSARY[k];
        _index.push({
          kind:    'glossary',
          id:      'g:' + k,
          name:    g.term  || '',
          summary: g.means || '',
          says:    g.says  || '',
        });
      }
    }

    return _index;
  }

  // ── Scoring ──────────────────────────────────────────────────────────
  function scoreItem(item, q) {
    // q is already lowercased + trimmed by the caller
    var name    = item.name.toLowerCase();
    var summary = (item.summary || '').toLowerCase();
    var phase   = (item.phaseName || '').toLowerCase();
    var lang    = (item.lang  || '').toLowerCase();
    var type    = (item.type  || '').toLowerCase();
    var says    = (item.says  || '').toLowerCase();

    var s = 0;

    // Exact full-name match — highest priority
    if (name === q) return 200;

    // Substring matches in name (most important signal)
    if (name.startsWith(q))        s += 100;
    else if (name.indexOf(q) !== -1) s +=  70;

    // Multi-word query: every word must appear somewhere in name
    var words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      var allInName = words.every(function (w) { return name.indexOf(w) !== -1; });
      if (allInName) {
        s += (s === 0 ? 65 : 20); // big bonus if nothing matched yet
      } else {
        // Weaker: every word spread across name + summary + phase
        var blob = name + ' ' + summary + ' ' + phase;
        var allInBlob = words.every(function (w) { return blob.indexOf(w) !== -1; });
        if (allInBlob) s += 15;
      }
    }

    // Supporting fields
    if (summary.indexOf(q)  !== -1) s += 25;
    if (says.indexOf(q)     !== -1) s += 22; // glossary "what people say"
    if (phase.indexOf(q)    !== -1) s += 18;
    if (lang.indexOf(q)     !== -1) s += 14;
    if (type.indexOf(q)     !== -1) s += 10;

    // Single-word fallback: word-boundary prefix match on name tokens
    if (s === 0 && words.length === 1) {
      var nameParts = name.split(/[\s\-–—:,]+/).filter(Boolean);
      for (var i = 0; i < nameParts.length; i++) {
        if (nameParts[i].startsWith(q)) { s += 30; break; }
      }
      // Last resort: single word anywhere in summary
      if (s === 0 && summary.indexOf(q) !== -1) s += 12;
    }

    return s;
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];

    var items   = buildIndex();
    var results = [];

    for (var i = 0; i < items.length; i++) {
      var s = scoreItem(items[i], q);
      if (s > 0) results.push({ item: items[i], s: s });
    }

    results.sort(function (a, b) { return b.s - a.s; });
    return results.slice(0, MAX_RESULTS).map(function (r) { return r.item; });
  }

  // ── Utilities ────────────────────────────────────────────────────────
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = (str == null) ? '' : String(str);
    return d.innerHTML;
  }

  /**
   * Highlight the first occurrence of `query` (or its first matching word)
   * inside `text`. Returns an HTML-safe string with a <mark> around the match.
   */
  function highlight(text, query) {
    if (!text) return '';
    if (!query) return escHtml(text);

    var lower = text.toLowerCase();
    var q     = query.trim().toLowerCase();
    var idx   = lower.indexOf(q);
    var matchLen = q.length;

    if (idx === -1) {
      // Try each word individually
      var words = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        idx = lower.indexOf(words[i]);
        if (idx !== -1) { matchLen = words[i].length; break; }
      }
    }

    if (idx === -1) return escHtml(text);

    return (
      escHtml(text.slice(0, idx)) +
      '<mark>' + escHtml(text.slice(idx, idx + matchLen)) + '</mark>' +
      escHtml(text.slice(idx + matchLen))
    );
  }

  function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    var cut = str.slice(0, max).replace(/\s+\S*$/, '');
    return (cut.length > max * 0.6 ? cut : str.slice(0, max)) + '…';
  }

  // ── Palette DOM (created lazily on first open) ────────────────────────
  function createPaletteDOM() {
    if (document.getElementById(PALETTE_ID)) return;

    // Detect platform for the footer shortcut hint
    var isMac = /Mac|iPhone|iPod|iPad/.test(
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform || ''
    );
    var shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

    var el = document.createElement('div');
    el.id = PALETTE_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Search lessons and glossary');

    el.innerHTML =
      '<div class="cp-backdrop" id="cpBackdrop"></div>' +
      '<div class="cp-panel">' +
        '<div class="cp-search-row">' +
          '<svg class="cp-search-icon" width="16" height="16" viewBox="0 0 24 24"' +
          ' fill="none" stroke="currentColor" stroke-width="2.5"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="8"/>' +
            '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<input class="cp-input" id="cpInput" type="search"' +
          ' placeholder="Search lessons and glossary…"' +
          ' autocomplete="off" autocorrect="off"' +
          ' autocapitalize="off" spellcheck="false"' +
          ' aria-label="Search" aria-autocomplete="list"' +
          ' aria-controls="cpResults">' +
          '<kbd class="cp-kbd-esc" id="cpKbdEsc">Esc</kbd>' +
        '</div>' +
        '<ul class="cp-results" id="cpResults"' +
        ' role="listbox" aria-label="Search results"></ul>' +
        '<div class="cp-footer">' +
          '<span class="cp-footer-group">' +
            '<kbd>↑</kbd><kbd>↓</kbd>' +
            '<span class="cp-footer-label">navigate</span>' +
          '</span>' +
          '<span class="cp-footer-group">' +
            '<kbd>↵</kbd>' +
            '<span class="cp-footer-label">open</span>' +
          '</span>' +
          '<span class="cp-footer-group">' +
            '<kbd>Esc</kbd>' +
            '<span class="cp-footer-label">close</span>' +
          '</span>' +
          '<span class="cp-footer-shortcut">' + shortcutLabel + '</span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    // Wire up internal interactions
    document.getElementById('cpBackdrop').addEventListener('click', close);
    document.getElementById('cpKbdEsc').addEventListener('click', close);

    var inp = document.getElementById('cpInput');
    inp.addEventListener('input', _onInput);
    inp.addEventListener('keydown', _onKeyDown);
  }

  function _palEl()   { return document.getElementById(PALETTE_ID); }
  function _inputEl() { return document.getElementById('cpInput'); }
  function _listEl()  { return document.getElementById('cpResults'); }

  // ── Open / close ─────────────────────────────────────────────────────
  function open() {
    if (_isOpen) {
      // Already open — make sure the input is focused
      var inp = _inputEl();
      if (inp) inp.focus();
      return;
    }

    _prevFocus = document.activeElement || null;
    _isOpen    = true;
    _activeIdx = -1;

    createPaletteDOM();
    document.body.setAttribute(BODY_ATTR, '');

    // Two-frame delay: first frame triggers transition, second ensures focus
    requestAnimationFrame(function () {
      var pal = _palEl();
      if (pal) pal.classList.add('cp-open');

      requestAnimationFrame(function () {
        var inp = _inputEl();
        if (inp) {
          inp.focus();
          renderResults([]); // show empty-state prompt
        }
      });
    });
  }

  function close() {
    if (!_isOpen) return;
    _isOpen    = false;
    _activeIdx = -1;

    var pal = _palEl();
    if (pal) pal.classList.remove('cp-open');
    document.body.removeAttribute(BODY_ATTR);

    // Return focus to wherever the user was before
    try {
      if (_prevFocus && typeof _prevFocus.focus === 'function') {
        _prevFocus.focus();
      }
    } catch (_) { /* element may have been removed from DOM */ }
    _prevFocus = null;
  }

  // ── Render results ───────────────────────────────────────────────────
  function renderResults(results) {
    var list = _listEl();
    if (!list) return;

    var query = (_inputEl() ? _inputEl().value : '').trim();

    if (!query) {
      list.innerHTML =
        '<li class="cp-empty" role="option" aria-disabled="true">' +
        'Type to search 400+ lessons and glossary terms' +
        '</li>';
      _activeIdx = -1;
      return;
    }

    if (results.length === 0) {
      list.innerHTML =
        '<li class="cp-empty" role="option" aria-disabled="true">' +
        'No results for <em>' + escHtml(query) + '</em>' +
        '</li>';
      _activeIdx = -1;
      return;
    }

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r    = results[i];
      var dest = '';
      var chip = '';
      var chipClass = 'cp-item-chip';

      if (r.kind === 'lesson') {
        // Prefer the in-site reader; fall back to GitHub URL
        dest = r.lessonPath
          ? 'lesson.html?path=' + encodeURIComponent(r.lessonPath)
          : r.url;
        chip = 'Phase ' + String(r.phaseId).padStart(2, '0');
      } else {
        dest      = 'glossary.html';
        chip      = 'Glossary';
        chipClass += ' cp-item-chip--alt';
      }

      var snippet = r.summary ? truncate(r.summary, 110) : '';
      var metaParts = [];
      if (r.kind === 'lesson') {
        if (r.type && r.type !== '—') metaParts.push(r.type);
        if (r.lang && r.lang !== '—') metaParts.push(r.lang);
      }
      var meta = metaParts.join(' · '); // ·

      html +=
        '<li class="cp-item" role="option" aria-selected="false"' +
        ' data-idx="' + i + '"' +
        ' data-href="' + escHtml(dest) + '">' +
          '<div class="cp-item-body">' +
            '<span class="' + chipClass + '">' + escHtml(chip) + '</span>' +
            '<span class="cp-item-name">'    + highlight(r.name,    query) + '</span>' +
            (snippet ? '<span class="cp-item-summary">' + highlight(snippet, query) + '</span>' : '') +
            (meta    ? '<span class="cp-item-meta">'    + escHtml(meta)             + '</span>' : '') +
          '</div>' +
          '<svg class="cp-item-arrow" width="12" height="12" viewBox="0 0 24 24"' +
          ' fill="none" stroke="currentColor" stroke-width="2"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<polyline points="9 18 15 12 9 6"/>' +
          '</svg>' +
        '</li>';
    }

    list.innerHTML = html;
    _activeIdx = -1;

    // Attach interaction handlers
    var items = list.querySelectorAll('.cp-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click',     _onItemClick);
      items[j].addEventListener('mousemove', _onItemMouseMove);
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────
  function _onInput(e) {
    var query = e.target.value;
    renderResults(search(query));
    _activeIdx = -1;
  }

  function _onKeyDown(e) {
    var list  = _listEl();
    var items = list ? list.querySelectorAll('.cp-item') : [];
    var count = items.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!count) return;
        _activeIdx = (_activeIdx + 1) % count;
        _updateActive(items);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!count) return;
        _activeIdx = (_activeIdx - 1 + count) % count;
        _updateActive(items);
        break;

      case 'Enter':
        e.preventDefault();
        var target = (_activeIdx >= 0 && items[_activeIdx])
          ? items[_activeIdx]
          : (count === 1 ? items[0] : null);
        if (target) _navigate(target);
        break;

      case 'Tab':
        // Trap focus inside the palette (only interactive element is the input)
        e.preventDefault();
        break;

      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  }

  function _updateActive(items) {
    for (var i = 0; i < items.length; i++) {
      var active = (i === _activeIdx);
      items[i].classList.toggle('cp-item--active', active);
      items[i].setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) items[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function _onItemClick(e) {
    _navigate(e.currentTarget);
  }

  function _onItemMouseMove(e) {
    var list = _listEl();
    if (!list) return;
    var idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
    if (idx !== _activeIdx) {
      _activeIdx = idx;
      _updateActive(list.querySelectorAll('.cp-item'));
    }
  }

  function _navigate(item) {
    var href = item.getAttribute('data-href');
    if (!href) return;
    close();
    window.location.href = href;
  }

  // ── Global keyboard shortcut (Cmd/Ctrl+K) ────────────────────────────
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (_isOpen) {
        // Palette is already open — just refocus the input
        var inp = _inputEl();
        if (inp) inp.focus();
      } else {
        open();
      }
    }
  });

  // ── Init: wire trigger buttons + eagerly build index ─────────────────
  function _init() {
    // Any element with [data-cmd-palette] opens the palette on click
    var triggers = document.querySelectorAll('[data-cmd-palette]');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener('click', function (e) {
        e.preventDefault();
        open();
      });
    }

    // Build the search index now so the first keystroke is instant
    buildIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.CmdPalette = { open: open, close: close };

}());
