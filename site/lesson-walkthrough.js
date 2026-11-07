(function (root) {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;
  var PROGRESS_KEY = 'aifs:progress:v2';
  var REVISIT_KEY = 'aifs:revisit:v1';
  var INTERVAL_DAYS = [1, 3, 7, 21, 60];
  var SPLIT_MIN_WIDTH = 1440;

  function sectionIndexAt(tops, position) {
    var index = -1;
    for (var i = 0; i < tops.length; i++) {
      if (tops[i] <= position) index = i;
      else break;
    }
    return index;
  }

  function stepAt(tops, sectionEnd, position) {
    if (sectionEnd !== null && sectionEnd <= position) return -1;
    return sectionIndexAt(tops, position);
  }

  function dueAt(lesson, entry) {
    if (entry && entry.at && lesson.completedAt > entry.at) entry = null;
    var step = entry && entry.step > 0 ? entry.step : 0;
    if (step >= INTERVAL_DAYS.length) return Infinity;
    var base = entry && entry.at ? entry.at : lesson.completedAt;
    return base + INTERVAL_DAYS[step] * DAY;
  }

  function nextRevisit(lessons, revisits, now, currentPath) {
    lessons = lessons || {};
    revisits = revisits || {};
    var best = null;
    var bestDue = Infinity;
    for (var path in lessons) {
      if (!Object.prototype.hasOwnProperty.call(lessons, path)) continue;
      if (path === currentPath) continue;
      var lesson = lessons[path];
      if (!lesson || !lesson.completedAt) continue;
      var due = dueAt(lesson, revisits[path]);
      if (due > now || due >= bestDue) continue;
      best = path;
      bestDue = due;
    }
    return best;
  }

  function recordRevisit(revisits, path, outcome, now) {
    var next = Object.assign({}, revisits || {});
    var entry = next[path] || { step: 0, at: 0 };
    if (outcome === 'recalled') next[path] = { step: entry.step + 1, at: now };
    else if (outcome === 'forgot') next[path] = { step: 0, at: now };
    else next[path] = { step: entry.step, at: now };
    return next;
  }

  function autoPinTarget(candidates, pinned) {
    if (pinned && !pinned.auto) return null;
    var best = null;
    for (var i = 0; i < candidates.length; i++) {
      if (!best || candidates[i].bottom > best.bottom) best = candidates[i];
    }
    return best ? best.entry : null;
  }

  function daysAgo(then, now) {
    var days = Math.floor((now - then) / DAY);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  var api = {
    DAY: DAY,
    INTERVAL_DAYS: INTERVAL_DAYS,
    sectionIndexAt: sectionIndexAt,
    stepAt: stepAt,
    nextRevisit: nextRevisit,
    recordRevisit: recordRevisit,
    autoPinTarget: autoPinTarget,
    daysAgo: daysAgo
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  var doc = root.document;
  var reduced = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var cleanups = [];

  function make(tag, className, text) {
    var el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanups.push(function () { target.removeEventListener(type, fn, opts); });
  }

  function readJson(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function headerOffset() {
    var value = parseFloat(root.getComputedStyle(doc.documentElement).getPropertyValue('--header-offset'));
    return Number.isFinite(value) ? value : 92;
  }

  function readingLine() {
    return headerOffset() + Math.min(150, root.innerHeight * 0.24);
  }

  function scrollBehavior() {
    return reduced.matches ? 'auto' : 'smooth';
  }

  function scrollTop() {
    return root.scrollY || doc.documentElement.scrollTop || 0;
  }

  function pageTop(node) {
    return node.getBoundingClientRect().top + scrollTop();
  }

  function createDock() {
    var dock = make('aside', 'wt-dock');
    dock.setAttribute('aria-label', 'Pinned figure');
    dock.hidden = true;
    var head = make('div', 'wt-dock-head');
    var back = make('button', 'wt-dock-btn', 'Show in lesson');
    back.type = 'button';
    var close = make('button', 'wt-dock-btn wt-dock-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Unpin figure');
    close.innerHTML = '<span aria-hidden="true">&times;</span>';
    head.appendChild(make('span', 'wt-dock-title', 'Pinned figure'));
    head.appendChild(back);
    head.appendChild(close);
    var body = make('div', 'wt-dock-body');
    dock.appendChild(head);
    dock.appendChild(body);
    doc.body.appendChild(dock);

    var pinned = null;
    var entries = [];

    function unpin(focusBar) {
      if (!pinned) return null;
      var current = pinned;
      pinned = null;
      current.bar.parentNode.insertBefore(current.figure, current.bar);
      current.bar.style.minHeight = '';
      current.button.textContent = 'Pin while reading';
      current.button.setAttribute('aria-pressed', 'false');
      current.bar.classList.remove('is-pinned');
      dock.hidden = true;
      doc.body.classList.remove('wt-has-dock');
      if (focusBar) current.button.focus({ preventScroll: true });
      return current;
    }

    function pin(entry, auto) {
      if (pinned === entry) return;
      if (auto && pinned && !pinned.auto) return;
      unpin(false);
      entry.bar.style.minHeight = entry.figure.offsetHeight + 'px';
      entry.auto = Boolean(auto);
      pinned = entry;
      body.appendChild(entry.figure);
      entry.button.textContent = 'Pinned beside the text. Unpin';
      entry.button.setAttribute('aria-pressed', 'true');
      entry.bar.classList.add('is-pinned');
      dock.hidden = false;
      doc.body.classList.add('wt-has-dock');
    }

    function dismiss() {
      if (pinned) pinned.dismissed = true;
      unpin(true);
    }

    function add(figure) {
      var bar = make('div', 'wt-figbar');
      var button = make('button', 'wt-pin-btn', 'Pin while reading');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.title = 'Keep this figure on screen while you read the code below';
      bar.appendChild(button);
      figure.parentNode.insertBefore(bar, figure.nextSibling);
      if (!figure.dataset.lfMounted && root.MutationObserver) {
        bar.hidden = true;
        var watcher = new root.MutationObserver(function () {
          if (!figure.dataset.lfMounted) return;
          bar.hidden = false;
          watcher.disconnect();
        });
        watcher.observe(figure, { attributes: true, attributeFilter: ['data-lf-mounted'] });
        cleanups.push(function () { watcher.disconnect(); });
      }
      var entry = { figure: figure, bar: bar, button: button, auto: false, dismissed: false };
      on(button, 'click', function () {
        if (pinned === entry) dismiss();
        else pin(entry, false);
      });
      entries.push(entry);
      return entry;
    }

    on(close, 'click', dismiss);
    on(back, 'click', function () {
      var current = unpin(false);
      if (!current) return;
      current.dismissed = true;
      root.scrollTo({ top: Math.max(0, pageTop(current.figure) - headerOffset() - 16), behavior: scrollBehavior() });
    });
    on(dock, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      dismiss();
    });
    cleanups.push(function () {
      unpin(false);
      dock.remove();
      entries.forEach(function (entry) { entry.bar.remove(); });
      doc.body.classList.remove('wt-split');
    });

    return {
      add: add,
      pin: pin,
      unpin: unpin,
      pinned: function () { return pinned; },
      entryFor: function (figure) {
        for (var i = 0; i < entries.length; i++) if (entries[i].figure === figure) return entries[i];
        return null;
      }
    };
  }

  function stepSection(article, host) {
    var headings = Array.prototype.slice.call(article.querySelectorAll('h2, h3'));
    var section = null;
    var steps = [];
    var end = null;
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      var before = Boolean(h.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (h.tagName === 'H2') {
        if (before) { section = h; steps = []; }
        else if (section) { end = h; break; }
        else break;
      } else if (section && h.id) {
        steps.push(h);
      }
    }
    return { steps: steps, end: end };
  }

  function mountStepSync(article, dock) {
    var syncs = [];
    var frame = 0;

    function update() {
      frame = 0;
      var line = scrollTop() + readingLine();
      var split = root.innerWidth >= SPLIT_MIN_WIDTH;
      var top = headerOffset();
      var candidates = [];
      syncs.forEach(function (sync) {
        var tops = sync.steps.map(pageTop);
        var end = sync.end ? pageTop(sync.end) : null;
        var index = stepAt(tops, end, line);
        if (index !== sync.index) {
          sync.index = index;
          sync.steps.forEach(function (h, n) { h.classList.toggle('wt-step-current', n === index); });
          sync.host.dispatchEvent(new CustomEvent('lf:step', { detail: { index: index } }));
        }
        var entry = sync.entry;
        if (!entry) return;
        var inside = index >= 0;
        if (!inside) entry.dismissed = false;
        var bottom = entry.bar.getBoundingClientRect().bottom;
        var placeAbove = bottom < top;
        if (split && inside && placeAbove && !entry.dismissed) candidates.push({ entry: entry, bottom: bottom });
        else if (dock.pinned() === entry && entry.auto && (!inside || !placeAbove || !split)) dock.unpin(false);
      });
      var target = autoPinTarget(candidates, dock.pinned());
      if (target) dock.pin(target, true);
    }

    function schedule() { if (!frame) frame = root.requestAnimationFrame(update); }

    on(article, 'lf:sync-ready', function (e) {
      var host = e.target;
      for (var i = 0; i < syncs.length; i++) if (syncs[i].host === host) return;
      var section = stepSection(article, host);
      if (!section.steps.length) return;
      syncs.push({ host: host, steps: section.steps, end: section.end, index: -2, entry: dock.entryFor(host) });
      doc.body.classList.add('wt-split');
      schedule();
    });
    on(doc, 'lf:step-request', function (e) {
      var host = e.target;
      var sync = null;
      for (var i = 0; i < syncs.length; i++) if (syncs[i].host === host || syncs[i].host.contains(host)) sync = syncs[i];
      if (!sync || !e.detail || e.detail.index < 0) return;
      var heading = sync.steps[e.detail.index];
      if (!heading) return;
      root.scrollTo({ top: Math.max(0, pageTop(heading) - readingLine() + 4), behavior: scrollBehavior() });
    });
    on(root, 'scroll', schedule, { passive: true });
    on(root, 'resize', schedule);
    cleanups.push(function () {
      if (frame) root.cancelAnimationFrame(frame);
      syncs.forEach(function (sync) { sync.steps.forEach(function (h) { h.classList.remove('wt-step-current'); }); });
    });
  }

  function lessonIndex() {
    var map = {};
    var phases = typeof PHASES !== 'undefined' ? PHASES : root.PHASES;
    if (!Array.isArray(phases) || !root.AIFSProgress) return map;
    phases.forEach(function (phase) {
      (phase.lessons || []).forEach(function (lesson) {
        var path = root.AIFSProgress.extractPath(lesson.url);
        if (path) map[path] = { name: lesson.name, summary: lesson.summary || '', phase: phase.name };
      });
    });
    return map;
  }

  function mountRevisit(article, currentPath) {
    var progress = readJson(PROGRESS_KEY);
    if (!progress || !progress.lessons) return;
    var revisits = readJson(REVISIT_KEY) || {};
    var now = Date.now();
    var index = lessonIndex();
    var lessons = {};
    for (var key in progress.lessons) {
      if (index[key]) lessons[key] = progress.lessons[key];
    }
    var path = nextRevisit(lessons, revisits, now, currentPath);
    if (!path) return;
    var meta = index[path];
    var lesson = lessons[path];

    var card = make('section', 'wt-revisit');
    card.setAttribute('aria-labelledby', 'wtRevisitTitle');
    var heading = make('p', 'wt-revisit-title', meta.name);
    heading.id = 'wtRevisitTitle';
    card.appendChild(make('p', 'wt-revisit-label', 'Revisit · completed ' + daysAgo(lesson.completedAt, now)));
    card.appendChild(heading);
    card.appendChild(make('p', 'wt-revisit-prompt', 'Before you start the exercises, explain the main idea of this earlier lesson in two sentences, from memory. Then check.'));
    if (meta.summary) {
      var details = make('details', 'wt-revisit-check');
      details.appendChild(make('summary', '', 'Check against its one-line summary'));
      details.appendChild(make('p', '', meta.summary));
      card.appendChild(details);
    }
    var actions = make('div', 'wt-revisit-actions');
    var recalled = make('button', 'wt-revisit-btn is-primary', 'I could explain it');
    recalled.type = 'button';
    var open = make('a', 'wt-revisit-btn', 'Not yet. Open the lesson');
    open.href = 'lesson?path=' + encodeURIComponent(path);
    var later = make('button', 'wt-revisit-btn is-quiet', 'Later');
    later.type = 'button';
    actions.appendChild(recalled);
    actions.appendChild(open);
    actions.appendChild(later);
    card.appendChild(actions);
    var status = make('p', 'wt-revisit-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    card.appendChild(status);

    var recorded = false;

    function finish(outcome, message) {
      if (recorded) return;
      if (!writeJson(REVISIT_KEY, recordRevisit(readJson(REVISIT_KEY) || {}, path, outcome, Date.now()))) {
        status.textContent = 'This browser did not save your answer. Try again.';
        return;
      }
      recorded = true;
      actions.hidden = true;
      status.textContent = message;
    }

    on(recalled, 'click', function () {
      var latest = readJson(REVISIT_KEY) || {};
      var step = (latest[path] && latest[path].step || 0) + 1;
      var nextDays = INTERVAL_DAYS[step];
      finish('recalled', nextDays ? 'Good. You will see it again in ' + nextDays + ' days.' : 'Good. This lesson is now retired from review.');
    });
    on(open, 'click', function () {
      finish('forgot', 'Opening the lesson. It will come back for review tomorrow.');
    });
    on(later, 'click', function () { finish('later', 'Snoozed. It will come back on a later visit.'); });

    var anchor = article.querySelector('#exercises, #key-terms, .lesson-nav-bottom');
    if (anchor) anchor.parentNode.insertBefore(card, anchor);
    else article.appendChild(card);
    cleanups.push(function () { card.remove(); });
  }

  function unmount() {
    while (cleanups.length) {
      try { cleanups.pop()(); } catch (_) {}
    }
  }

  function mount(article, options) {
    unmount();
    if (!article) return;
    options = options || {};
    var dock = createDock();
    Array.prototype.forEach.call(article.querySelectorAll('.lesson-figure[data-figure]'), dock.add);
    mountStepSync(article, dock);
    mountRevisit(article, options.path || '');
  }

  root.AIFSWalkthrough = { mount: mount, unmount: unmount };
})(typeof window !== 'undefined' ? window : this);
