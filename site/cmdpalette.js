/**
 * Command palette — global search triggered by Cmd/Ctrl+K or the search button.
 *
 * Searches focused paths, lesson titles, summaries, phase names, languages,
 * types, and glossary terms entirely client-side from data already loaded.
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

  function learningPathEntryPath(entry) {
    return typeof entry === 'string' ? entry : entry && entry.path ? entry.path : '';
  }

  function learningPathDestination(lessonPath, learningPathId) {
    if (!lessonPath || !learningPathId) return '';
    return 'lesson.html?path=' + encodeURIComponent(lessonPath) +
      '&learningPath=' + encodeURIComponent(learningPathId);
  }

  function resultIndexForEnter(activeIndex, resultCount) {
    if (activeIndex >= 0 && activeIndex < resultCount) return activeIndex;
    return resultCount > 0 ? 0 : -1;
  }

  // ── Search index ─────────────────────────────────────────────────────
  function certificationData() {
    var data = null;
    if (typeof CLAUDE_CERTIFICATION_DATA !== 'undefined' && CLAUDE_CERTIFICATION_DATA) {
      data = CLAUDE_CERTIFICATION_DATA;
    } else if (typeof CERTIFICATIONS !== 'undefined' && CERTIFICATIONS) {
      data = CERTIFICATIONS;
    }

    var tracks = null;
    if (typeof CERTIFICATION_TRACKS !== 'undefined' && CERTIFICATION_TRACKS) {
      tracks = Array.isArray(CERTIFICATION_TRACKS)
        ? CERTIFICATION_TRACKS
        : CERTIFICATION_TRACKS.tracks;
    }

    if (!data && tracks) data = { tracks: tracks };
    else if (data && !Array.isArray(data.tracks) && tracks) {
      data = Object.assign({}, data, { tracks: tracks });
    }
    return data;
  }

  /**
   * Build the flat search index once from window.PHASES and window.GLOSSARY.
   * Idempotent: subsequent calls return the cached array.
   */
  function buildIndex() {
    if (_index !== null) return _index;
    _index = [];

    if (typeof LEARNING_PATHS !== 'undefined' && Array.isArray(LEARNING_PATHS)) {
      for (var lp = 0; lp < LEARNING_PATHS.length; lp++) {
        var learningPath = LEARNING_PATHS[lp] || {};
        var route = Array.isArray(learningPath.lessons) ? learningPath.lessons : [];
        var firstLessonPath = route.length ? learningPathEntryPath(route[0]) : '';
        var learningPathId = learningPath.id || String(lp);
        if (!firstLessonPath) continue;
        var checkpointKeywords = Array.isArray(learningPath.checkpoints)
          ? learningPath.checkpoints.map(function (checkpoint) {
              return typeof checkpoint === 'string'
                ? checkpoint
                : checkpoint && (checkpoint.title || checkpoint.name || checkpoint.goal) || '';
            }).join(' ')
          : '';
        _index.push({
          kind:        'learning-path',
          id:          'lp:' + learningPathId,
          name:        learningPath.title || learningPathId,
          summary:     learningPath.summary || '',
          keywords:    [learningPath.keywords || '', checkpointKeywords, 'focused course route'].filter(Boolean).join(' '),
          lessonCount: route.length,
          minutes:     Number(learningPath.estimatedMinutes || 0),
          url:         learningPathDestination(firstLessonPath, learningPathId),
        });
      }
    }

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
            name:       lesson.name     || '',
            summary:    lesson.summary  || '',
            keywords:   lesson.keywords || '',
            type:       lesson.type     || '',
            lang:       lesson.lang     || '',
            status:     lesson.status   || '',
            lessonPath: lessonPath,
            url:        lesson.url      || '',
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
          slug:    g.slug  || '',
          keywords: [
            g.category,
            g.whyItMatters,
            g.example,
            g.confusion,
            g.whyCalled,
            Array.isArray(g.aliases) ? g.aliases.join(' ') : '',
            Array.isArray(g.related) ? g.related.join(' ') : '',
          ].filter(Boolean).join(' '),
        });
      }
    }

    if (typeof ARTIFACTS !== 'undefined' && Array.isArray(ARTIFACTS)) {
      for (var a = 0; a < ARTIFACTS.length; a++) {
        var art = ARTIFACTS[a];
        _index.push({
          kind:       'artifact',
          id:         'a:' + a,
          artKind:    art.kind || 'artifact',
          name:       art.name || '',
          summary:    art.description || '',
          keywords:   Array.isArray(art.tags) ? art.tags.join(' ') : '',
          phaseId:    art.phase,
          lesson:     art.lesson,
          lessonPath: art.lessonPath || '',
          file:       art.file || '',
        });
      }
    }

    // Certification data is optional. Index it only on pages that already
    // loaded one of the supported globals; never fetch the large data bundle
    // solely for search.
    var certs = certificationData();
    if (certs) {
      var tracks = Array.isArray(certs.tracks) ? certs.tracks : [];
      for (var t = 0; t < tracks.length; t++) {
        var track = tracks[t] || {};
        var trackId = track.id || track.slug || track.examCode || String(t);
        var domainNames = Array.isArray(track.domains)
          ? track.domains.map(function (domain) { return domain.name || domain.id || ''; }).join(' ')
          : '';
        _index.push({
          kind:     'certification-track',
          id:       'ct:' + trackId,
          name:     track.credential || track.name || track.shortName || track.examCode || 'Certification track',
          summary:  track.summary || track.audience || '',
          keywords: [track.shortName, track.examCode, track.level, track.audience, domainNames].filter(Boolean).join(' '),
          examCode: track.examCode || '',
          level:    track.level || '',
          url:      'certification.html?id=' + encodeURIComponent(trackId),
        });
      }

      var lessonMap = certs.lessonsByPath || {};
      var lessonList = Array.isArray(certs.lessons) ? certs.lessons : [];
      var certLessons = Object.keys(lessonMap).map(function (path) {
        var lesson = lessonMap[path] || {};
        return Object.assign({ path: path }, lesson);
      }).concat(lessonList);
      var seenCertLessons = {};

      for (var c = 0; c < certLessons.length; c++) {
        var certLesson = certLessons[c] || {};
        var certPath = certLesson.path || certLesson.lessonPath || '';
        if (!certPath || seenCertLessons[certPath]) continue;
        seenCertLessons[certPath] = true;
        _index.push({
          kind:       'certification-lesson',
          id:         'cl:' + certPath,
          name:       certLesson.name || certLesson.title || certLesson.slug || 'Certification lesson',
          summary:    certLesson.summary || '',
          keywords:   certLesson.keywords || '',
          type:       certLesson.type || '',
          lang:       certLesson.languages || certLesson.lang || '',
          lessonPath: certPath,
        });
      }
    }

    return _index;
  }

  function rebuildIndex() {
    _index = null;
    return buildIndex();
  }

  function refreshOpenPalette() {
    if (!_isOpen) return;
    var input = _inputEl();
    var query = input ? input.value.trim() : '';
    renderResults(query ? search(query) : []);
  }

  // ── Scoring ──────────────────────────────────────────────────────────
  function scoreItem(item, q) {
    // q is already lowercased + trimmed by the caller
    var name     = item.name.toLowerCase();
    var summary  = (item.summary  || '').toLowerCase();
    var keywords = (item.keywords || '').toLowerCase();
    var phase    = (item.phaseName || '').toLowerCase();
    var lang     = (item.lang  || '').toLowerCase();
    var type     = (item.type  || '').toLowerCase();
    var says     = (item.says  || '').toLowerCase();

    var s = 0;

    // Exact full-name match — highest priority
    if (name === q) return 200;

    // Substring matches in name (most important signal)
    if (name.startsWith(q))          s += 100;
    else if (name.indexOf(q) !== -1) s +=  70;
    if (item.kind === 'learning-path' && name.startsWith(q)) s += 100;

    // Multi-word query: every word must appear somewhere in name
    var words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      var allInName = words.every(function (w) { return name.indexOf(w) !== -1; });
      if (allInName) {
        s += (s === 0 ? 65 : 20);
      } else {
        // Weaker: every word spread across name + summary + keywords + phase
        var blob = name + ' ' + summary + ' ' + keywords + ' ' + phase;
        var allInBlob = words.every(function (w) { return blob.indexOf(w) !== -1; });
        if (allInBlob) s += 15;
      }
    }

    // Supporting fields — ordered by expected relevance
    if (summary.indexOf(q)  !== -1) s += 25;
    if (keywords.indexOf(q) !== -1) s += 22; // H3 headings: dense vocabulary
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
      // Last resort: single word anywhere in keywords or summary
      if (s === 0 && keywords.indexOf(q) !== -1) s += 18;
      if (s === 0 && summary.indexOf(q)  !== -1) s += 12;
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
    el.setAttribute('aria-label', 'Search learning paths, lessons, and glossary');
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;

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
          ' placeholder="Search paths, lessons, and glossary…"' +
          ' autocomplete="off" autocorrect="off"' +
          ' autocapitalize="off" spellcheck="false"' +
          ' role="combobox" aria-label="Search" aria-autocomplete="list"' +
          ' aria-haspopup="listbox" aria-expanded="false"' +
          ' aria-controls="cpResults">' +
          '<button class="cp-kbd-esc" id="cpClose" type="button"' +
          ' aria-label="Close search">Esc</button>' +
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
    document.getElementById('cpClose').addEventListener('click', close);
    el.addEventListener('keydown', _onDialogKeyDown);

    var inp = document.getElementById('cpInput');
    inp.addEventListener('input', _onInput);
    inp.addEventListener('keydown', _onKeyDown);
  }

  function _palEl()   { return document.getElementById(PALETTE_ID); }
  function _inputEl() { return document.getElementById('cpInput'); }
  function _listEl()  { return document.getElementById('cpResults'); }

  function _clearActiveDescendant() {
    var input = _inputEl();
    if (input) input.removeAttribute('aria-activedescendant');
  }

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

    var pal = _palEl();
    if (pal) {
      pal.inert = false;
      pal.setAttribute('aria-hidden', 'false');
      pal.classList.add('cp-open');
    }

    var input = _inputEl();
    if (input) {
      input.setAttribute('aria-expanded', 'true');
      _clearActiveDescendant();
      input.focus();
      var q = input.value.trim();
      renderResults(q ? search(q) : []);
    }
  }

  function close() {
    if (!_isOpen) return;
    _isOpen    = false;
    _activeIdx = -1;

    var pal = _palEl();
    if (pal) {
      pal.classList.remove('cp-open');
      pal.setAttribute('aria-hidden', 'true');
      pal.inert = true;
    }
    var input = _inputEl();
    if (input) input.setAttribute('aria-expanded', 'false');
    _clearActiveDescendant();
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
      var inventory = buildIndex();
      var lessonCount = inventory.filter(function (item) { return item.kind === 'lesson'; }).length;
      var certificationLessonCount = inventory.filter(function (item) { return item.kind === 'certification-lesson'; }).length;
      var learningPathCount = inventory.filter(function (item) { return item.kind === 'learning-path'; }).length;
      var artifactCount = inventory.filter(function (item) { return item.kind === 'artifact'; }).length;
      var glossaryCount = inventory.filter(function (item) { return item.kind === 'glossary'; }).length;
      var inventoryParts = [lessonCount + ' lessons'];
      if (learningPathCount) {
        inventoryParts.push(learningPathCount + ' focused learning ' + (learningPathCount === 1 ? 'path' : 'paths'));
      }
      if (certificationLessonCount) {
        inventoryParts.push(certificationLessonCount + ' certification lessons');
      }
      inventoryParts.push(artifactCount + ' outputs');
      inventoryParts.push(glossaryCount + ' glossary terms');
      list.innerHTML =
        '<li class="cp-empty" role="option" aria-disabled="true">' +
        'Search ' + inventoryParts.slice(0, -1).join(', ') + ', and ' +
        inventoryParts[inventoryParts.length - 1] +
        '</li>';
      _activeIdx = -1;
      _clearActiveDescendant();
      return;
    }

    if (results.length === 0) {
      list.innerHTML =
        '<li class="cp-empty" role="option" aria-disabled="true">' +
        'No results for <em>' + escHtml(query) + '</em>' +
        '</li>';
      _activeIdx = -1;
      _clearActiveDescendant();
      return;
    }

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r    = results[i];
      var dest = '';
      var chip = '';
      var chipClass = 'cp-item-chip';

      if (r.kind === 'learning-path') {
        dest = r.url;
        chip = 'Learning path';
        chipClass += ' cp-item-chip--alt';
      } else if (r.kind === 'lesson') {
        // Prefer the in-site reader; fall back to GitHub URL
        dest = r.lessonPath
          ? 'lesson.html?path=' + encodeURIComponent(r.lessonPath)
          : r.url;
        chip = 'Phase ' + String(r.phaseId).padStart(2, '0');
      } else if (r.kind === 'certification-lesson') {
        dest = 'lesson.html?path=' + encodeURIComponent(r.lessonPath);
        chip = 'Certification';
        chipClass += ' cp-item-chip--alt';
      } else if (r.kind === 'certification-track') {
        dest = r.url;
        chip = r.examCode || 'Certification';
        chipClass += ' cp-item-chip--alt';
      } else if (r.kind === 'artifact') {
        // Jump to the lesson that produced this artifact
        dest = r.lessonPath
          ? 'lesson.html?path=' + encodeURIComponent(r.lessonPath)
          : ('https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/' + r.file);
        var ak = (r.artKind || 'artifact');
        chip = ak.charAt(0).toUpperCase() + ak.slice(1);
        chipClass += ' cp-item-chip--alt';
      } else {
        // Prefer the canonical term anchor. Legacy generated data falls back
        // to the exact-name query until the next site build.
        dest      = r.slug
          ? 'glossary.html#' + encodeURIComponent(r.slug)
          : 'glossary.html?q=' + encodeURIComponent(r.name);
        chip      = 'Glossary';
        chipClass += ' cp-item-chip--alt';
      }

      var snippet = r.summary ? truncate(r.summary, 110) : '';
      var metaParts = [];
      if (r.kind === 'learning-path') {
        if (r.lessonCount) metaParts.push(r.lessonCount + ' lessons');
        if (r.minutes) {
          var hours = Math.floor(r.minutes / 60);
          var minutes = r.minutes % 60;
          metaParts.push(((hours ? hours + 'h' : '') + (minutes ? ' ' + minutes + 'm' : '')).trim());
        }
      } else if (r.kind === 'lesson' || r.kind === 'certification-lesson') {
        if (r.type && r.type !== '—') metaParts.push(r.type);
        if (r.lang && r.lang !== '—') metaParts.push(r.lang);
      } else if (r.kind === 'certification-track') {
        if (r.level) metaParts.push(r.level);
      } else if (r.kind === 'artifact') {
        if (r.phaseId !== undefined && r.phaseId !== null) {
          metaParts.push('Phase ' + String(r.phaseId).padStart(2, '0'));
        }
      }
      var meta = metaParts.join(' · '); // ·

      html +=
        '<li class="cp-item" id="cpOption-' + i + '" role="option" aria-selected="false"' +
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
    _clearActiveDescendant();

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

      case 'Enter': {
        e.preventDefault();
        var targetIndex = resultIndexForEnter(_activeIdx, count);
        var target = targetIndex >= 0 ? items[targetIndex] : null;
        if (target) _navigate(target);
        break;
      }

    }
  }

  function _onDialogKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }

    if (e.key !== 'Tab') return;
    var input = _inputEl();
    var closeButton = document.getElementById('cpClose');
    if (!input || !closeButton) return;

    if (e.shiftKey && document.activeElement === input) {
      e.preventDefault();
      closeButton.focus();
    } else if (!e.shiftKey && document.activeElement === closeButton) {
      e.preventDefault();
      input.focus();
    }
  }

  function _updateActive(items) {
    var input = _inputEl();
    var activeId = '';
    for (var i = 0; i < items.length; i++) {
      var active = (i === _activeIdx);
      items[i].classList.toggle('cp-item--active', active);
      items[i].setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        activeId = items[i].id;
        items[i].scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }
    if (input && activeId) input.setAttribute('aria-activedescendant', activeId);
    else _clearActiveDescendant();
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
  if (typeof document !== 'undefined') {
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
  }

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

    // Build the core index now so the first keystroke is instant. On lesson
    // pages, certification-data.js is loaded on demand and may still be in
    // flight. Rebuild after it settles so an early core-only cache cannot
    // permanently hide certification tracks and lessons.
    buildIndex();

    var certificationReady = window.__AIFS_CERTIFICATION_DATA_READY;
    if (certificationReady && typeof certificationReady.then === 'function') {
      certificationReady.then(function () {
        rebuildIndex();
        refreshOpenPalette();
      }).catch(function () {
        // Keep the already-built core index available when the optional
        // certification bundle cannot be loaded.
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init);
    } else {
      _init();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.CmdPalette = { open: open, close: close };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      rebuildIndex: rebuildIndex,
      search: search,
      learningPathDestination: learningPathDestination,
      resultIndexForEnter: resultIndexForEnter,
    };
  }

}());
