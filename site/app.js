(function () {
  var root = document.documentElement;
  var stored = localStorage.getItem('theme');
  if (stored) {
    root.setAttribute('data-theme', stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
  updateThemeIcon();

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    populateStats();
    renderPhases();
    initStaggerIndex();
    initModal();
    initCopyButton();
    initSmoothScroll();
    initFadeObserver();
    initScrollExplode();
  });

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    if (!icon) return;
    var theme = root.getAttribute('data-theme');
    icon.textContent = theme === 'light' ? 'N' : 'D';
  }

  function initThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon();
    });
    updateThemeIcon();
  }

  function computeStats() {
    var totalLessons = 0;
    var completeLessons = 0;
    var hasProgress = !!window.AIFSProgress;
    for (var i = 0; i < PHASES.length; i++) {
      var lessons = PHASES[i].lessons;
      totalLessons += lessons.length;
      for (var j = 0; j < lessons.length; j++) {
        var staticDone = lessons[j].status === 'complete';
        var userDone = false;
        if (hasProgress && lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (staticDone || userDone) completeLessons++;
      }
    }
    var completePhases = 0;
    for (var p = 0; p < PHASES.length; p++) {
      if (PHASES[p].status === 'complete') completePhases++;
    }
    return {
      lessons: totalLessons,
      phases: PHASES.length,
      complete: completeLessons,
      completePhases: completePhases
    };
  }

  function setBar(selector, pct) {
    var el = document.querySelector(selector);
    if (!el) return;
    var clamped = Math.max(0, Math.min(100, pct));
    el.setAttribute('data-target-pct', clamped.toFixed(1));
    if (el.classList.contains('in-view') || !window.IntersectionObserver) {
      el.style.setProperty('--bar-pct', clamped.toFixed(1) + '%');
    } else {
      el.style.setProperty('--bar-pct', '0%');
    }
  }

  function populateStats() {
    var stats = computeStats();
    var pct = stats.lessons > 0 ? (stats.complete / stats.lessons) * 100 : 0;
    var phasePct = stats.phases > 0 ? (stats.completePhases / stats.phases) * 100 : 0;
    var glossaryCount = (typeof GLOSSARY !== 'undefined') ? GLOSSARY.length : 0;

    setText('[data-stat="complete-frac"]', stats.complete + ' / ' + stats.lessons);
    setText('[data-stat="phases-frac"]', stats.completePhases + ' / ' + stats.phases);
    setText('[data-stat="glossary-count"]', String(glossaryCount));
    setBar('[data-bar="complete"]', pct);
    setBar('[data-bar="phases"]', phasePct);
    setBar('[data-bar="languages"]', 100);
    setBar('[data-bar="glossary"]', glossaryCount > 0 ? 100 : 0);
  }

  function setText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function renderPhases() {
    var grid = document.getElementById('phasesGrid');
    if (!grid) return;
    var hasProgress = !!window.AIFSProgress;
    var html = '';
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      var total = p.lessons.length;
      var done = 0;
      for (var j = 0; j < p.lessons.length; j++) {
        var staticDone = p.lessons[j].status === 'complete';
        var userDone = false;
        if (hasProgress && p.lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(p.lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (staticDone || userDone) done++;
      }
      var statusClass = p.status.replace(/ /g, '-');
      var roman = toRoman(p.id);
      var num = String(p.id).padStart(2, '0');
      html += '<div class="toc-row" data-phase="' + i + '" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open Phase ' + num + ': ' + escapeHtml(p.name) + '">';
      html += '<span class="toc-num">' + roman + '.</span>';
      html += '<div><span class="toc-status ' + statusClass + '"></span><span class="toc-name">' + escapeHtml(p.name) + '</span></div>';
      html += '<span class="toc-meta">' + done + ' / ' + total + '</span>';
      html += '<span class="toc-meta">' + num + '</span>';
      html += '</div>';
    }
    grid.innerHTML = html;

    // Re-apply per-row stagger delays for the freshly created rows.
    initStaggerIndex();

    // If the reveal observer has already initialised (body.js-anim is set),
    // the IntersectionObserver is only watching the *original* rows it was
    // given at startup. Re-rendering via innerHTML replaces those nodes with
    // brand-new elements that are NOT being observed, so they would otherwise
    // stay hidden forever under `body.js-anim .toc-row { opacity: 0 }`.
    //
    // Since the user has already seen the initial reveal animation, just mark
    // the rebuilt rows as visible immediately (no second fade-in).
    if (document.body.classList.contains('js-anim')) {
      var newRows = grid.querySelectorAll('.toc-row');
      for (var r = 0; r < newRows.length; r++) {
        newRows[r].classList.add('in-view', 'visible');
      }
    }
  }

  function toRoman(num) {
    var lookup = [
      ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
      ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
      ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];
    var n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return String(num);
    var out = '';
    for (var k = 0; k < lookup.length; k++) {
      while (n >= lookup[k][1]) {
        out += lookup[k][0];
        n -= lookup[k][1];
      }
    }
    return out;
  }

  function initModal() {
    var overlay = document.getElementById('modalOverlay');
    var modal = document.getElementById('modal');
    var closeBtn = document.getElementById('modalClose');
    if (!overlay || !modal || !closeBtn) return;

    overlay.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalTitle');
    modal.setAttribute('aria-describedby', 'modalDesc');
    closeBtn.setAttribute('aria-label', 'Close phase details');

    document.addEventListener('click', function (e) {
      var row = e.target.closest('.toc-row, .phase-card');
      if (row) {
        var idx = parseInt(row.getAttribute('data-phase'), 10);
        if (!isNaN(idx)) openModal(idx, false);
      }
    });

    document.addEventListener('keydown', function (e) {
      var row = e.target.closest && e.target.closest('.toc-row, .phase-card');
      if (!row || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      var idx = parseInt(row.getAttribute('data-phase'), 10);
      if (!isNaN(idx)) openModal(idx, true);
    });

    closeBtn.addEventListener('click', function () { closeModal(false); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal(true);
        return;
      }
      if (e.key !== 'Tab' || !overlay.classList.contains('open')) return;
      var focusable = modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    var resetBtn = document.getElementById('modalReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!window.AIFSProgress) return;
        var ok = window.confirm('Clear all your local progress (quiz answers and completed lessons)? This cannot be undone.');
        if (!ok) return;
        window.AIFSProgress.reset();
      });
    }
  }

  var currentPhaseIdx = -1;
  var modalReturnFocus = null;

  function openModal(idx, fromKeyboard) {
    var p = PHASES[idx];
    if (!p) return;
    currentPhaseIdx = idx;
    modalReturnFocus = document.activeElement;

    document.getElementById('modalPhaseNum').textContent = 'PHASE ' + String(p.id).padStart(2, '0');
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.desc;

    renderModalLessons(p);

    var overlay = document.getElementById('modalOverlay');
    overlay.classList.toggle('no-motion', !!fromKeyboard);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      var close = document.getElementById('modalClose');
      if (close) close.focus();
      overlay.classList.remove('no-motion');
    });
  }

  function renderModalLessons(p) {
    var container = document.getElementById('modalLessons');
    if (!container) return;

    var hasProgress = !!window.AIFSProgress;
    var userDone = 0;
    var html = '';

    for (var i = 0; i < p.lessons.length; i++) {
      var l = p.lessons[i];
      var pathMatch = l.url ? l.url.match(/(phases\/[^/]+\/[^/]+)\/?$/) : null;
      var lessonPath = pathMatch ? pathMatch[1] : '';
      var userComplete = hasProgress && lessonPath && window.AIFSProgress.isLessonComplete(lessonPath);
      if (userComplete) userDone++;

      var canOpen = (l.status === 'complete' || userComplete) && lessonPath;
      var lessonUrl = canOpen ? 'lesson.html?path=' + encodeURIComponent(lessonPath) : '';
      var lessonLabel = escapeHtml(l.name);
      var lessonMeta = '<span class="modal-lesson-meta"><span class="modal-lesson-type" data-type="' + escapeHtml(l.type) + '"' + (l.combines ? ' title="Combines: ' + escapeHtml(l.combines) + '"' : '') + '>' + escapeHtml(l.type) + '</span><span aria-hidden="true">·</span><span class="modal-lesson-lang">' + escapeHtml(l.lang) + '</span></span>';

      html += '<div class="modal-lesson' + (userComplete ? ' user-done' : '') + '">';
      if (canOpen) {
        html += '<a href="' + lessonUrl + '" class="modal-lesson-open" aria-label="Open lesson: ' + lessonLabel + '">';
        html += '<span class="modal-lesson-copy"><span class="modal-lesson-name">' + lessonLabel + '</span>' + lessonMeta + '</span>';
        html += '<span class="modal-lesson-cta">' + (userComplete ? 'Review' : 'Open lesson') + '<span aria-hidden="true">→</span></span></a>';
      } else {
        html += '<span class="modal-lesson-open is-unavailable" aria-disabled="true">';
        html += '<span class="modal-lesson-copy"><span class="modal-lesson-name">' + lessonLabel + '</span>' + lessonMeta + '</span>';
        html += '<span class="modal-lesson-cta">Coming soon</span></span>';
      }

      var toggleHtml = '';
      if (hasProgress && canOpen) {
        toggleHtml = '<button type="button" class="modal-lesson-toggle' + (userComplete ? ' done' : '') + '" data-path="' + lessonPath + '" title="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '" aria-label="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '"><span class="modal-lesson-check" aria-hidden="true">' + (userComplete ? '✓' : '') + '</span><span class="modal-lesson-toggle-label">' + (userComplete ? 'Done' : 'Mark done') + '</span></button>';
      }
      html += toggleHtml;
      html += '</div>';
    }

    container.innerHTML = html;

    var toggles = container.querySelectorAll('.modal-lesson-toggle');
    for (var t = 0; t < toggles.length; t++) {
      toggles[t].addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var path = this.getAttribute('data-path');
        if (!path || !window.AIFSProgress) return;
        if (window.AIFSProgress.isLessonComplete(path)) {
          window.AIFSProgress.unmarkLessonComplete(path);
        } else {
          window.AIFSProgress.markLessonComplete(path);
        }
      });
    }

    var progEl = document.getElementById('modalProgress');
    var barEl = document.getElementById('modalProgressBar');
    var barFill = document.getElementById('modalProgressBarFill');
    if (hasProgress && p.lessons.length > 0) {
      var pct = Math.round((userDone / p.lessons.length) * 100);
      if (progEl) {
        progEl.style.display = '';
        progEl.innerHTML = '<span><strong class="modal-progress-count">' + userDone + '</strong> of ' + p.lessons.length + ' lessons complete</span><span class="modal-progress-pct">' + pct + '%</span>';
      }
      if (barEl && barFill) {
        barEl.style.display = '';
        barEl.setAttribute('role', 'progressbar');
        barEl.setAttribute('aria-label', p.name + ' progress');
        barEl.setAttribute('aria-valuemin', '0');
        barEl.setAttribute('aria-valuemax', '100');
        barEl.setAttribute('aria-valuenow', String(pct));
        barFill.style.transform = 'scaleX(' + (pct / 100) + ')';
      }
    } else {
      if (progEl) progEl.style.display = 'none';
      if (barEl) barEl.style.display = 'none';
    }
  }

  if (window.AIFSProgress) {
    window.AIFSProgress.onChange(function () {
      if (currentPhaseIdx >= 0 && PHASES[currentPhaseIdx]) {
        renderModalLessons(PHASES[currentPhaseIdx]);
      }
      populateStats();
      renderPhases();
    });
  }

  function closeModal(fromKeyboard) {
    var overlay = document.getElementById('modalOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    overlay.classList.toggle('no-motion', !!fromKeyboard);
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalReturnFocus && modalReturnFocus.isConnected && typeof modalReturnFocus.focus === 'function') {
      modalReturnFocus.focus();
    }
    modalReturnFocus = null;
    requestAnimationFrame(function () {
      overlay.classList.remove('no-motion');
    });
  }

  // One clipboard implementation for every copy chip on the site: debounced
  // copied-state revert, execCommand fallback when the async API is denied.
  function wireCopyButton(btn, label, getText) {
    if (!btn || !label) return;
    var revertTimer = null;
    var defaultLabel = label.textContent || 'copy';
    var defaultAriaLabel = btn.getAttribute('aria-label') || 'Copy command';
    function resetCopyState() {
      label.textContent = defaultLabel;
      btn.classList.remove('copied');
      btn.setAttribute('aria-label', defaultAriaLabel);
    }
    function scheduleReset() {
      if (revertTimer) clearTimeout(revertTimer);
      revertTimer = setTimeout(resetCopyState, 1500);
    }
    function confirmCopied() {
      label.textContent = 'copied';
      btn.classList.add('copied');
      btn.setAttribute('aria-label', 'Command copied');
      scheduleReset();
    }
    function reportCopyFailure() {
      label.textContent = 'retry';
      btn.classList.remove('copied');
      btn.setAttribute('aria-label', 'Copy failed. Try again');
      scheduleReset();
    }
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      if (copied) confirmCopied();
      else reportCopyFailure();
    }
    btn.addEventListener('click', function () {
      var text = getText();
      if (!text) {
        reportCopyFailure();
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(confirmCopied).catch(function () { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    });
  }

  function initCopyButton() {
    var code = document.getElementById('cloneCmd');
    if (code) {
      wireCopyButton(
        document.getElementById('copyBtn'),
        document.getElementById('copyBtnLabel'),
        function () { return code.textContent; }
      );
    }
    var installBtn = document.getElementById('installCopy');
    if (installBtn) {
      wireCopyButton(
        installBtn,
        document.getElementById('installCopyLabel'),
        function () { return installBtn.getAttribute('data-cmd'); }
      );
    }
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function initFadeObserver() {
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!window.IntersectionObserver || prefersReduced) {
      document.querySelectorAll('.reveal, .fade-in, .stat-row-bar').forEach(function (el) {
        el.classList.add('in-view', 'visible');
        var target = el.getAttribute('data-target-pct');
        if (target !== null) el.style.setProperty('--bar-pct', target + '%');
      });
      return;
    }

    document.body.classList.add('js-anim');

    var els = document.querySelectorAll('.reveal, .fade-in, .stat-row-bar, .ascii-rule, .toc-row');
    if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var el = entries[i].target;
          el.classList.add('in-view', 'visible');
          var target = el.getAttribute('data-target-pct');
          if (target !== null) {
            el.style.setProperty('--bar-pct', target + '%');
          }
          observer.unobserve(el);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  }

  function initStaggerIndex() {
    var rows = document.querySelectorAll('.toc-list .toc-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.setProperty('--stagger-delay', (i * 30) + 'ms');
    }
  }

  function initScrollExplode() {
    var containers = document.querySelectorAll('[data-svg-explode]');
    if (!containers.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (var c = 0; c < containers.length; c++) applyExplode(containers[c], 1);
      return;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      for (var i = 0; i < containers.length; i++) {
        var rect = containers[i].getBoundingClientRect();
        var startEdge = vh;
        var endEdge = vh * 0.35;
        var raw = (startEdge - rect.top) / (startEdge - endEdge);
        var progress = Math.max(0, Math.min(1, raw));
        progress = 1 - Math.pow(1 - progress, 3);
        applyExplode(containers[i], progress);
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  function applyExplode(container, progress) {
    // Each layer / label animates over its own window in [stagger_start, stagger_start + window].
    // Sequential reveal: layer N waits for layer N-1 to mostly settle before starting.
    var STAGGER_DENOM = 720; // higher → wider gaps between layer entrances
    var WINDOW = 0.55;       // each layer's local animation duration as fraction of global progress

    function localProgress(staggerAttr) {
      var stagger = parseFloat(staggerAttr) || 0;
      var start = stagger / STAGGER_DENOM;
      var local = (progress - start) / WINDOW;
      if (local < 0) local = 0;
      if (local > 1) local = 1;
      // ease-out cubic on the local segment
      return 1 - Math.pow(1 - local, 3);
    }

    var layers = container.querySelectorAll('.explode-layer');
    for (var i = 0; i < layers.length; i++) {
      var final = parseFloat(layers[i].getAttribute('data-final')) || 0;
      var lp = localProgress(layers[i].getAttribute('data-stagger'));
      var dy = -final * lp;
      layers[i].setAttribute('transform', 'translate(0, ' + dy.toFixed(2) + ')');
      layers[i].setAttribute('opacity', lp.toFixed(3));
    }
    var labels = container.querySelectorAll('.explode-label');
    for (var j = 0; j < labels.length; j++) {
      var final2 = parseFloat(labels[j].getAttribute('data-final')) || 0;
      var lp2 = localProgress(labels[j].getAttribute('data-stagger'));
      var dy2 = -final2 * lp2;
      labels[j].setAttribute('transform', 'translate(0, ' + dy2.toFixed(2) + ')');
      labels[j].setAttribute('opacity', lp2.toFixed(3));
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
})();
