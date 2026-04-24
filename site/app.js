
(function () {
  var root = document.documentElement;
  var stored = localStorage.getItem('theme');
  if (stored) {
    root.setAttribute('data-theme', stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    root.setAttribute('data-theme', 'light');
  }
  updateThemeIcon();

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    populateStats();
    renderPhases();
    renderRoadmap();
    renderGlossaryPreview();
    initModal();
    initCopyButton();
    initSmoothScroll();
    initFadeObserver();
    initHeroSearch();
  });

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    if (!icon) return;
    var theme = root.getAttribute('data-theme');
    icon.innerHTML = theme === 'light' ? '&#9728;' : '&#9789;';
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
    return {
      lessons: totalLessons,
      phases: PHASES.length,
      complete: completeLessons
    };
  }

  function animateCount(el, target) {
    var start = 0;
    var duration = 1200;
    var startTime = null;

    function tick(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function populateStats() {
    var stats = computeStats();
    var els = document.querySelectorAll('.stat-number');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-target');
      if (stats[key] !== undefined) {
        animateCount(els[i], stats[key]);
      }
    }
  }

  function renderPhases() {
    var grid = document.getElementById('phasesGrid');
    if (!grid) return;
    var html = '';
    var rotations = [-1.5, 0.8, -0.7, 1.2, -1, 0.5, -0.3, 1.4, -1.2, 0.6, -0.8, 1.1, -0.4, 0.9, -1.3, 0.7, -0.6, 1.3, -0.9, 0.4];
    var hasProgress = !!window.AIFSProgress;
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
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      var rot = rotations[i % rotations.length];
      html += '<div class="phase-card fade-in ' + p.status.replace(/ /g, '-') + '" data-phase="' + i + '" style="transform:rotate(' + rot + 'deg)">';
      html += '<span class="phase-card-status ' + p.status + '">' + p.status + '</span>';
      html += '<span class="phase-card-num">Phase ' + String(p.id).padStart(2, '0') + '</span>';
      html += '<div class="phase-card-name">' + escapeHtml(p.name) + '</div>';
      html += '<div class="phase-card-desc">' + escapeHtml(p.desc) + '</div>';
      html += '<div class="phase-card-progress"><div class="phase-card-progress-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="phase-card-meta">' + done + '/' + total + ' lessons</div>';
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  function renderRoadmap() {
    var stats = computeStats();
    var pct = stats.lessons > 0 ? Math.round((stats.complete / stats.lessons) * 100) : 0;

    var fill = document.getElementById('roadmapFill');
    if (fill) fill.style.width = pct + '%';

    var pctEl = document.getElementById('roadmapPct');
    if (pctEl) pctEl.textContent = pct + '%';

    var grid = document.getElementById('roadmapGrid');
    if (!grid) return;
    var html = '';
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      html += '<div class="roadmap-item fade-in">';
      html += '<span class="roadmap-dot ' + p.status + '"></span>';
      html += '<span class="roadmap-name">' + String(p.id).padStart(2, '0') + ' ' + escapeHtml(p.name) + '</span>';
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  function renderGlossaryPreview() {
    var container = document.getElementById('glossaryPreview');
    if (!container || typeof GLOSSARY === 'undefined') return;
    var sample = GLOSSARY.slice(0, 8);
    var html = '';
    for (var i = 0; i < sample.length; i++) {
      html += '<span class="glossary-chip">' + escapeHtml(sample[i].term) + '</span>';
    }
    container.innerHTML = html;
  }

  function initModal() {
    var overlay = document.getElementById('modalOverlay');
    var closeBtn = document.getElementById('modalClose');
    if (!overlay || !closeBtn) return;

    document.addEventListener('click', function (e) {
      var card = e.target.closest('.phase-card');
      if (card) {
        var idx = parseInt(card.getAttribute('data-phase'), 10);
        openModal(idx);
      }
    });

    closeBtn.addEventListener('click', function () {
      closeModal();
    });

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

    document.getElementById('modalPhaseNum').textContent = 'Phase ' + String(p.id).padStart(2, '0');
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

      var statusClass = l.status;
      if (userComplete) statusClass = 'complete';

      html += '<div class="modal-lesson' + (userComplete ? ' user-done' : '') + '">';
      html += '<span class="modal-lesson-status ' + statusClass + '"' + (userComplete ? ' title="You completed this lesson"' : '') + '></span>';
      if (l.url) {
        html += '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHtml(l.name) + '</a>';
      } else {
        html += '<a>' + escapeHtml(l.name) + '</a>';
      }
      html += '<span class="modal-lesson-type" data-type="' + escapeHtml(l.type) + '">' + escapeHtml(l.type) + '</span>';
      html += '<span class="modal-lesson-lang">' + escapeHtml(l.lang) + '</span>';

      var actionHtml = '';
      if ((l.status === 'complete' || userComplete) && lessonPath) {
        actionHtml = '<a href="lesson.html?path=' + lessonPath + '" class="modal-lesson-read">' + (userComplete ? 'Review' : 'Read') + '</a>';
      }
      var toggleHtml = '';
      if (hasProgress && lessonPath) {
        toggleHtml = '<button type="button" class="modal-lesson-toggle' + (userComplete ? ' done' : '') + '" data-path="' + lessonPath + '" title="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '" aria-label="' + (userComplete ? 'Mark as not done' : 'Mark complete') + '">' + (userComplete ? '\u2713' : '+') + '</button>';
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
        progEl.innerHTML = '<span class="modal-progress-count">' + userDone + ' / ' + p.lessons.length + '</span> <span class="modal-progress-label">completed by you</span> <span class="modal-progress-pct">' + pct + '%</span>';
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
      updateHeroProgressStat();
      renderPhases();
    });
  }

  function updateHeroProgressStat() {
    var stats = computeStats();
    var el = document.querySelector('.stat-number[data-target="complete"]');
    if (el) el.textContent = String(stats.complete);
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function initCopyButton() {
    var btn = document.getElementById('copyBtn');
    var code = document.getElementById('cloneCmd');
    if (!btn || !code) return;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = '\u2713';
        setTimeout(function () {
          btn.innerHTML = '&#128203;';
        }, 1500);
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

  function initHeroSearch() {
    var form = document.querySelector('.hero-search');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      var input = form.querySelector('input[name="q"]');
      if (!input) return;
      var trimmed = input.value.trim();
      if (!trimmed) {
        e.preventDefault();
        return;
      }
      input.value = trimmed;
    });
  }

  function initFadeObserver() {
    var els = document.querySelectorAll('.fade-in');
    if (!els.length) return;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('visible');
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();

(function() {
  var viewer = document.querySelector('spline-viewer');
  if (!viewer) return;
  var interval = setInterval(function() {
    var shadow = viewer.shadowRoot;
    if (!shadow) return;
    var style = document.createElement('style');
    style.textContent = '#logo, a[href*="spline"], div[id="logo"] { display: none !important; height: 0 !important; overflow: hidden !important; }';
    shadow.appendChild(style);
    clearInterval(interval);
  }, 500);
  setTimeout(function() { clearInterval(interval); }, 10000);
})();
