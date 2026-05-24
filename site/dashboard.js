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

  function extractLessonPath(url) {
    var m = url ? url.match(/(phases\/[^/]+\/[^/]+)\/?$/) : null;
    return m ? m[1] : '';
  }

  function countPhaseDone(phase) {
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

  function findContinueTarget(phases) {
    var hasProgress = !!window.AIFSProgress;
    for (var i = 0; i < phases.length; i++) {
      var p = phases[i];
      for (var j = 0; j < p.lessons.length; j++) {
        var l = p.lessons[j];
        var lp = extractLessonPath(l.url);
        if (!lp) continue;
        if (!hasProgress) return { phaseId: p.id, lessonPath: lp };
        if (!window.AIFSProgress.isLessonComplete(lp)) return { phaseId: p.id, lessonPath: lp };
      }
    }
    return { phaseId: 1, lessonPath: 'phases/01-math-foundations/01-linear-algebra-intuition' };
  }

  function renderKpis(phases) {
    var el = document.getElementById('dashKpis');
    if (!el) return;

    var totalLessons = 0;
    var doneLessons = 0;
    for (var i = 0; i < phases.length; i++) {
      totalLessons += phases[i].lessons.length;
      var c = countPhaseDone(phases[i]);
      doneLessons += c.done;
    }

    var pct = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;
    el.innerHTML =
      '<div class="kpi-card"><div class="kpi-label">Lessons<\/div><div class="kpi-value">' + doneLessons + ' / ' + totalLessons + '<\/div><div class="kpi-sub">' + pct + '% complete<\/div><\/div>' +
      '<div class="kpi-card"><div class="kpi-label">Phases<\/div><div class="kpi-value">' + phases.length + '<\/div><div class="kpi-sub">Browse any time<\/div><\/div>' +
      '<div class="kpi-card"><div class="kpi-label">Storage<\/div><div class="kpi-value">Local<\/div><div class="kpi-sub">No account needed<\/div><\/div>';
  }

  function renderPhaseCards(phases) {
    var grid = document.getElementById('phaseGrid');
    if (!grid) return;
    var html = '';
    for (var i = 0; i < phases.length; i++) {
      var p = phases[i];
      var c = countPhaseDone(p);
      var pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
      html += '<a class="phase-card" href="phase.html?phase=' + encodeURIComponent(p.id) + '">';
      html += '<div class="phase-card-top">';
      html += '<div class="phase-card-num">PHASE ' + String(p.id).padStart(2, '0') + '<\/div>';
      html += '<div class="phase-card-name">' + escapeHtml(p.name) + '<\/div>';
      html += '<div class="phase-card-meta">' + c.done + ' / ' + c.total + ' lessons<\/div>';
      html += '<\/div>';
      html += '<div class="phase-card-bar"><span style="width:' + pct + '%"><\/span><\/div>';
      html += '<div class="phase-card-desc">' + escapeHtml(p.desc || '') + '<\/div>';
      html += '<\/a>';
    }
    grid.innerHTML = html;
  }

  function render() {
    if (typeof PHASES === 'undefined' || !Array.isArray(PHASES)) return;

    renderKpis(PHASES);
    renderPhaseCards(PHASES);

    var target = findContinueTarget(PHASES);
    var btn = document.getElementById('continueBtn');
    if (btn && target.lessonPath) btn.href = 'lesson.html?path=' + encodeURIComponent(target.lessonPath);

    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!window.AIFSProgress) return;
        var ok = window.confirm('Clear all your local progress (quiz answers and completed lessons)? This cannot be undone.');
        if (!ok) return;
        window.AIFSProgress.reset();
        renderKpis(PHASES);
        renderPhaseCards(PHASES);
      });
    }
  }
})();
