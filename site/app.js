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
    renderLearningCommand();
    renderPhases();
    initCourseUniverse();
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
        var userDone = false;
        if (hasProgress && lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (userDone) completeLessons++;
      }
    }
    var completePhases = 0;
    for (var p = 0; p < PHASES.length; p++) {
      var phaseLessons = PHASES[p].lessons;
      if (phaseLessons.length && phaseLessons.every(function (lesson) {
        var path = lesson.url && hasProgress ? window.AIFSProgress.extractPath(lesson.url) : '';
        return path && window.AIFSProgress.isLessonComplete(path);
      })) completePhases++;
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
        var userDone = false;
        if (hasProgress && p.lessons[j].url) {
          var lp = window.AIFSProgress.extractPath(p.lessons[j].url);
          if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
        }
        if (userDone) done++;
      }
      var statusClass = p.status.replace(/ /g, '-');
      var roman = toRoman(p.id);
      var num = String(p.id).padStart(2, '0');
      html += '<div class="toc-row" data-phase="' + i + '">';
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

  function courseLessons() {
    var out = [];
    for (var i = 0; i < PHASES.length; i++) {
      for (var j = 0; j < PHASES[i].lessons.length; j++) {
        var lesson = PHASES[i].lessons[j];
        var path = lesson.url && window.AIFSProgress ? window.AIFSProgress.extractPath(lesson.url) : '';
        if (path) out.push({ phase: PHASES[i], lesson: lesson, path: path });
      }
    }
    return out;
  }

  function renderLearningCommand() {
    var card = document.getElementById('learningCommand');
    if (!card || !window.AIFSProgress) return;
    var lessons = courseLessons();
    if (!lessons.length) return;

    var state = window.AIFSProgress.getState();
    var completed = 0;
    for (var i = 0; i < lessons.length; i++) {
      if (state.lessons[lessons[i].path] && state.lessons[lessons[i].path].completedAt) completed++;
    }
    var overallPct = Math.round((completed / lessons.length) * 100);
    var recent = window.AIFSProgress.getMostRecentLesson();
    var recentIndex = -1;
    if (recent) {
      for (var r = 0; r < lessons.length; r++) {
        if (lessons[r].path === recent.path) { recentIndex = r; break; }
      }
    }

    var targetIndex = recentIndex >= 0 ? recentIndex : 0;
    if (recentIndex >= 0 && window.AIFSProgress.isLessonComplete(lessons[recentIndex].path)) {
      for (var n = recentIndex + 1; n < lessons.length; n++) {
        if (!window.AIFSProgress.isLessonComplete(lessons[n].path)) { targetIndex = n; break; }
      }
    }
    var target = lessons[targetIndex];
    var targetProgress = window.AIFSProgress.getLessonProgress(target.path);
    var readingPct = Math.round(targetProgress.scrollPercent || 0);

    var ring = document.getElementById('learningProgressRing');
    var pctEl = document.getElementById('learningProgressPct');
    var kicker = document.getElementById('learningCommandKicker');
    var title = document.getElementById('learningCommandTitle');
    var meta = document.getElementById('learningCommandMeta');
    var link = document.getElementById('continueLearning');
    if (ring) ring.style.setProperty('--progress', (overallPct * 3.6) + 'deg');
    if (pctEl) pctEl.textContent = overallPct + '%';
    if (kicker) kicker.textContent = recent ? 'Continue Â· Phase ' + String(target.phase.id).padStart(2, '0') : 'Start Â· Phase ' + String(target.phase.id).padStart(2, '0');
    if (title) title.textContent = target.lesson.name;
    if (meta) meta.textContent = completed + ' of ' + lessons.length + ' lessons completed' + (readingPct > 1 ? ' Â· resume at ' + readingPct + '%' : '') + '. Progress stays saved on this device.';
    if (link) {
      link.href = 'lesson.html?path=' + encodeURIComponent(target.path) + (readingPct > 1 ? '&resume=1' : '');
      link.textContent = readingPct > 1 ? 'Resume lesson' : (recent ? 'Continue learning' : 'Start course');
    }
  }

  function initCourseUniverse() {
    var scene = document.getElementById('courseUniverse');
    var canvas = document.getElementById('courseUniverseCanvas');
    var nodeLayer = document.getElementById('courseUniverseNodes');
    if (!scene || !canvas || !nodeLayer || typeof PHASES === 'undefined') return;

    var ctx = canvas.getContext('2d');
    var nodes = [];
    var points = [];
    var rotationX = -0.18;
    var rotationY = -0.45;
    var dragging = false;
    var previousX = 0;
    var previousY = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (var i = 0; i < PHASES.length; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'course-universe-node phase-card';
      button.setAttribute('data-phase', i);
      button.setAttribute('aria-label', 'Open Phase ' + PHASES[i].id + ': ' + PHASES[i].name);
      button.title = 'Phase ' + PHASES[i].id + ' Â· ' + PHASES[i].name;
      button.textContent = 'P' + String(PHASES[i].id).padStart(2, '0');
      var phaseDone = PHASES[i].lessons.length > 0 && PHASES[i].lessons.every(function (lesson) {
        var path = lesson.url && window.AIFSProgress ? window.AIFSProgress.extractPath(lesson.url) : '';
        return path && window.AIFSProgress.isLessonComplete(path);
      });
      if (phaseDone) button.classList.add('done');
      nodeLayer.appendChild(button);
      nodes.push(button);

      var angle = (i / PHASES.length) * Math.PI * 4.2;
      var radius = 175 + (i % 3) * 31;
      points.push({ x: Math.cos(angle) * radius, y: (i - (PHASES.length - 1) / 2) * 19, z: Math.sin(angle) * radius });
    }

    function project(point) {
      var cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);
      var x1 = point.x * cosY - point.z * sinY;
      var z1 = point.x * sinY + point.z * cosY;
      var cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);
      var y1 = point.y * cosX - z1 * sinX;
      var z2 = point.y * sinX + z1 * cosX;
      var scale = 650 / (650 - z2);
      return { x: x1 * scale, y: y1 * scale, z: z2, scale: scale };
    }

    function resize() {
      var rect = scene.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      var rect = scene.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      var projected = points.map(project);
      var styles = getComputedStyle(document.documentElement);
      ctx.strokeStyle = styles.getPropertyValue('--blueprint').trim() || '#3553ff';
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < projected.length; i++) {
        var p = projected[i];
        var px = rect.width / 2 + p.x;
        var py = rect.height / 2 + p.y;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      for (var n = 0; n < nodes.length; n++) {
        var pt = projected[n];
        var scale = Math.max(0.62, Math.min(1.28, pt.scale));
        nodes[n].style.transform = 'translate(-50%, -50%) translate3d(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px,0) scale(' + scale.toFixed(2) + ')';
        nodes[n].style.opacity = String(Math.max(0.45, Math.min(1, 0.72 + pt.z / 700)));
        nodes[n].style.zIndex = String(Math.round(pt.z + 300));
      }
    }

    function frame() {
      if (!dragging) rotationY += 0.0014;
      draw();
      if (!reduced) window.requestAnimationFrame(frame);
    }

    scene.addEventListener('pointerdown', function (event) {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      scene.setPointerCapture(event.pointerId);
    });
    scene.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      rotationY += (event.clientX - previousX) * 0.008;
      rotationX = Math.max(-0.8, Math.min(0.55, rotationX - (event.clientY - previousY) * 0.005));
      previousX = event.clientX;
      previousY = event.clientY;
      if (reduced) draw();
    });
    scene.addEventListener('pointerup', function () { dragging = false; });
    scene.addEventListener('pointercancel', function () { dragging = false; });
    window.addEventListener('resize', function () { resize(); draw(); });
    resize();
    frame();
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
    var closeBtn = document.getElementById('modalClose');
    if (!overlay || !closeBtn) return;

    document.addEventListener('click', function (e) {
      var row = e.target.closest('.toc-row, .phase-card');
      if (row) {
        var idx = parseInt(row.getAttribute('data-phase'), 10);
        if (!isNaN(idx)) openModal(idx);
      }
    });

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
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

  function openModal(idx) {
    var p = PHASES[idx];
    if (!p) return;
    currentPhaseIdx = idx;

    document.getElementById('modalPhaseNum').textContent = 'PHASE ' + String(p.id).padStart(2, '0');
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.desc;

    renderModalLessons(p);

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
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

      var statusClass = l.status.replace(/ /g, '-');
      if (userComplete) statusClass = 'complete';

      html += '<div class="modal-lesson' + (userComplete ? ' user-done' : '') + '">';
      html += '<span class="modal-lesson-status ' + statusClass + '"' + (userComplete ? ' title="You completed this lesson"' : '') + '></span>';
      if (l.url) {
        html += '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHtml(l.name) + '</a>';
      } else {
        html += '<a>' + escapeHtml(l.name) + '</a>';
      }
      html += '<span class="modal-lesson-type" data-type="' + escapeHtml(l.type) + '"' + (l.combines ? ' title="Combines: ' + escapeHtml(l.combines) + '"' : '') + '>' + escapeHtml(l.type) + '</span>';
      html += '<span class="modal-lesson-lang">' + escapeHtml(l.lang) + '</span>';

      var actionHtml = '';
      if ((l.status === 'complete' || userComplete) && lessonPath) {
        actionHtml = '<a href="lesson.html?path=' + lessonPath + '" class="modal-lesson-read">' + (userComplete ? 'Review' : 'Read') + '</a>';
      }
      var toggleHtml = '';
      if (hasProgress && lessonPath) {
        toggleHtml = '<button type="button" class="modal-lesson-toggle' + (userComplete ? ' done' : '') + '" data-path="' + lessonPath + '" title="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '" aria-label="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '">' + (userComplete ? '✓' : '+') + '</button>';
      }
      html += (actionHtml || '<span class="modal-lesson-read-placeholder" aria-hidden="true"></span>') + toggleHtml;
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
        progEl.innerHTML = '<span class="modal-progress-count">' + userDone + ' / ' + p.lessons.length + '</span> <span class="modal-progress-label">completed</span> <span class="modal-progress-pct">' + pct + '%</span>';
      }
      if (barEl && barFill) {
        barEl.style.display = '';
        barFill.style.width = pct + '%';
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
      renderLearningCommand();
      renderPhases();
    });
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function initCopyButton() {
    var btn = document.getElementById('copyBtn');
    var code = document.getElementById('cloneCmd');
    if (!btn || !code) return;
    var originalLabel = btn.textContent;
    var revertTimer = null;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = '✓';
        if (revertTimer) clearTimeout(revertTimer);
        revertTimer = setTimeout(function () { btn.textContent = originalLabel; }, 1500);
      });
    });
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
