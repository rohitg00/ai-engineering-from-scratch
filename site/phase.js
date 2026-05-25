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

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    render();
  });

  function initThemeToggle() {
    var btn = document.getElementById('themeToggle');
    var icon = document.getElementById('themeIcon');
    if (!btn || !icon) return;
    function paint() {
      var theme = root.getAttribute('data-theme');
      icon.textContent = theme === 'light' ? 'N' : 'D';
    }
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      paint();
    });
    paint();
  }

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }

  function extractLessonPath(url) {
    var m = url ? url.match(/(phases\/[^/]+\/[^/]+)\/?$/) : null;
    return m ? m[1] : '';
  }

  function countDone(phase) {
    var total = phase.lessons.length;
    var done = 0;
    var hasProgress = !!window.AIFSProgress;
    for (var i = 0; i < phase.lessons.length; i++) {
      var l = phase.lessons[i];
      var userDone = false;
      if (hasProgress && l.url) {
        var lp = extractLessonPath(l.url);
        if (lp) userDone = window.AIFSProgress.isLessonComplete(lp);
      }
      if (userDone) done++;
    }
    return { done: done, total: total };
  }

  function renderSidebar(phases, activeId) {
    var el = document.getElementById('phaseSidebar');
    if (!el) return;
    var html = '<div class="phase-sidebar-head">Phases<\/div>';
    for (var i = 0; i < phases.length; i++) {
      var p = phases[i];
      var c = countDone(p);
      var pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
      html += '<a class="phase-side-item' + (p.id === activeId ? ' active' : '') + '" href="phase.html?phase=' + encodeURIComponent(p.id) + '">';
      html += '<span class="phase-side-num">' + String(p.id).padStart(2, '0') + '<\/span>';
      html += '<span class="phase-side-name">' + escapeHtml(p.name) + '<\/span>';
      html += '<span class="phase-side-meta">' + pct + '%<\/span>';
      html += '<\/a>';
    }
    el.innerHTML = html;
  }

  function renderHeader(phase) {
    var el = document.getElementById('phaseHeader');
    if (!el) return;
    var c = countDone(phase);
    var pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    el.innerHTML =
      '<div class="phase-breadcrumb"><a href="dashboard.html">Dashboard<\/a> <span>\/<\/span> Phase ' + String(phase.id).padStart(2, '0') + '<\/div>' +
      '<div class="phase-title-row">' +
        '<h1 class="phase-title">' + escapeHtml(phase.name) + '<\/h1>' +
        '<div class="phase-progress-pill">' + c.done + ' / ' + c.total + ' (' + pct + '%)<\/div>' +
      '<\/div>' +
      '<p class="phase-desc">' + escapeHtml(phase.desc || '') + '<\/p>';
  }

  function renderLessons(phase) {
    var el = document.getElementById('phaseLessons');
    if (!el) return;
    var hasProgress = !!window.AIFSProgress;
    var html = '';
    for (var i = 0; i < phase.lessons.length; i++) {
      var l = phase.lessons[i];
      var lessonPath = extractLessonPath(l.url);
      var userComplete = hasProgress && lessonPath && window.AIFSProgress.isLessonComplete(lessonPath);

      html += '<div class="lesson-tile' + (userComplete ? ' done' : '') + '">';
      html += '<div class="lesson-tile-main">';
      html += '<div class="lesson-tile-title">' + escapeHtml(l.name) + '<\/div>';
      html += '<div class="lesson-tile-meta">';
      html += '<span class="lesson-pill" data-kind="type">' + escapeHtml(l.type || 'Lesson') + '<\/span>';
      html += '<span class="lesson-pill" data-kind="lang">' + escapeHtml(l.lang || '—') + '<\/span>';
      html += '<span class="lesson-pill" data-kind="status">' + escapeHtml(userComplete ? 'Complete' : 'Planned') + '<\/span>';
      html += '<\/div>';
      html += '<\/div>';

      html += '<div class="lesson-tile-actions">';
      if (lessonPath) html += '<a class="btn btn-primary" href="lesson.html?path=' + encodeURIComponent(lessonPath) + '">Open<\/a>';
      if (hasProgress && lessonPath) {
        html += '<button class="btn lesson-toggle" type="button" data-path="' + escapeAttr(lessonPath) + '">' + (userComplete ? 'Unmark' : 'Mark done') + '<\/button>';
      }
      html += '<\/div>';
      html += '<\/div>';
    }
    el.innerHTML = html;

    var toggles = el.querySelectorAll('.lesson-toggle');
    for (var t = 0; t < toggles.length; t++) {
      toggles[t].addEventListener('click', function () {
        if (!window.AIFSProgress) return;
        var p = this.getAttribute('data-path');
        if (!p) return;
        if (window.AIFSProgress.isLessonComplete(p)) window.AIFSProgress.unmarkLessonComplete(p);
        else window.AIFSProgress.markLessonComplete(p);
        renderHeader(phase);
        renderSidebar(PHASES, phase.id);
        renderLessons(phase);
      });
    }
  }

  function render() {
    if (typeof PHASES === 'undefined' || !Array.isArray(PHASES)) return;

    var raw = qs('phase');
    var id = parseInt(raw || '1', 10);
    if (isNaN(id)) id = 1;
    var phase = null;
    for (var i = 0; i < PHASES.length; i++) if (PHASES[i].id === id) phase = PHASES[i];
    if (!phase) phase = PHASES[0];

    renderSidebar(PHASES, phase.id);
    renderHeader(phase);
    renderLessons(phase);
    document.title = 'Phase ' + String(phase.id).padStart(2, '0') + ' - AI Engineering from Scratch';
  }
})();
