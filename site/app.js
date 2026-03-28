(function() {
  var prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('neural-canvas');
  if (!canvas || prefersReduced) return;

  var ctx = canvas.getContext('2d');
  var w, h, nodes, raf;

  function isDark() {
    var theme = document.documentElement.getAttribute('data-theme');
    if (theme) return theme === 'dark';
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width * devicePixelRatio;
    h = canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    initNodes();
  }

  function initNodes() {
    var rw = w / devicePixelRatio;
    var rh = h / devicePixelRatio;
    var count = Math.min(40, Math.floor(rw * rh / 10000));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * rw,
        y: Math.random() * rh,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1.5 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#D97757';
  }

  function draw() {
    var rw = w / devicePixelRatio;
    var rh = h / devicePixelRatio;
    ctx.clearRect(0, 0, rw, rh);
    var accent = getAccent();
    var dark = isDark();
    var maxDist = 160;
    var t = Date.now() * 0.001;
    var nodeAlpha = dark ? 0.4 : 0.15;
    var lineAlpha = dark ? 0.2 : 0.1;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -10) n.x = rw + 10;
      if (n.x > rw + 10) n.x = -10;
      if (n.y < -10) n.y = rh + 10;
      if (n.y > rh + 10) n.y = -10;

      for (var j = i + 1; j < nodes.length; j++) {
        var m = nodes[j];
        var dx = n.x - m.x;
        var dy = n.y - m.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          var alpha = (1 - dist / maxDist) * lineAlpha;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = accent;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var nd = nodes[k];
      var glow = nodeAlpha + 0.15 * Math.sin(t * 1.2 + nd.pulse);
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(nd.x, nd.y, nd.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = glow * 0.12;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
})();

(function() {
  var toggle = document.querySelector('[data-theme-toggle]');
  var root = document.documentElement;
  var theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateIcon();

  toggle && toggle.addEventListener('click', function() {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    updateIcon();
  });

  function updateIcon() {
    if (!toggle) return;
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
  }
})();

(function() {
  var header = document.getElementById('header');
  var lastY = 0;
  window.addEventListener('scroll', function() {
    var y = window.scrollY;
    header.classList.toggle('header--scrolled', y > 40);
    header.classList.toggle('header--hidden', y > 300 && y > lastY);
    lastY = y;
  }, { passive: true });
})();

(function() {
  var totalLessons = 0, totalComplete = 0;
  PHASES.forEach(function(p) {
    totalLessons += p.lessons.length;
    totalComplete += p.lessons.filter(function(l) { return l.status === 'complete'; }).length;
  });

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    var target = parseInt(val, 10);
    el.setAttribute('data-target', target);
    el.textContent = val;
  }

  setVal('stat-lessons', totalLessons + '+');
  setVal('stat-phases', PHASES.length);
  setVal('stat-complete', totalComplete);

  var prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  var nums = document.querySelectorAll('.stat__num[data-target]');
  var animated = false;

  function animateCounters() {
    if (animated) return;
    animated = true;
    nums.forEach(function(el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      if (!target || target === 0) return;
      var suffix = el.textContent.includes('+') ? '+' : '';
      var start = 0;
      var duration = 1200;
      var startTime = null;

      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(start + (target - start) * eased);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }

      el.textContent = '0' + suffix;
      requestAnimationFrame(step);
    });
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        animateCounters();
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  var statsEl = document.querySelector('.hero__stats');
  if (statsEl) observer.observe(statsEl);
})();

(function() {
  var grid = document.getElementById('phases-grid');
  if (!grid) return;

  PHASES.forEach(function(phase) {
    var total = phase.lessons.length;
    var done = phase.lessons.filter(function(l) { return l.status === 'complete'; }).length;
    var pct = Math.round((done / total) * 100);

    var statusClass = phase.status === 'complete' ? 'phase--complete'
      : phase.status === 'in-progress' ? 'phase--progress'
      : 'phase--planned';

    var statusLabel = phase.status === 'complete' ? 'Complete'
      : phase.status === 'in-progress' ? 'In Progress'
      : 'Planned';

    var card = document.createElement('button');
    card.className = 'phase-card ' + statusClass;
    card.setAttribute('aria-label', 'Phase ' + phase.id + ': ' + phase.name);
    card.innerHTML =
      '<div class="phase-card__top">' +
        '<span class="phase-card__num">' + String(phase.id).padStart(2, '0') + '</span>' +
        '<span class="phase-card__status">' + statusLabel + '</span>' +
      '</div>' +
      '<h3 class="phase-card__name">' + phase.name + '</h3>' +
      '<p class="phase-card__desc">' + phase.desc + '</p>' +
      '<div class="phase-card__bar-wrap">' +
        '<div class="phase-card__bar">' +
          '<div class="phase-card__bar-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="phase-card__pct">' + done + '/' + total + '</span>' +
      '</div>';
    card.addEventListener('click', function() { openModal(phase); });
    grid.appendChild(card);
  });
})();

var modal = document.getElementById('modal');
var modalBackdrop = document.getElementById('modal-backdrop');
var modalClose = document.getElementById('modal-close');

function openModal(phase) {
  var total = phase.lessons.length;
  var done = phase.lessons.filter(function(l) { return l.status === 'complete'; }).length;
  var pct = Math.round((done / total) * 100);

  document.getElementById('modal-phase-num').textContent = 'Phase ' + phase.id;
  document.getElementById('modal-title').textContent = phase.name;
  document.getElementById('modal-desc').textContent = phase.desc;
  document.getElementById('modal-progress-fill').style.width = pct + '%';
  document.getElementById('modal-progress-text').textContent = done + ' of ' + total + ' lessons complete (' + pct + '%)';

  var list = document.getElementById('modal-lessons');
  list.innerHTML = '';
  phase.lessons.forEach(function(lesson, i) {
    var icon = lesson.status === 'complete' ? '&#10003;' : lesson.status === 'in-progress' ? '&#9679;' : '&#9675;';
    var cls = lesson.status === 'complete' ? 'lesson--done' : lesson.status === 'in-progress' ? 'lesson--wip' : 'lesson--planned';

    var content =
      '<span class="lesson-row__icon">' + icon + '</span>' +
      '<span class="lesson-row__num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="lesson-row__name">' + lesson.name + '</span>' +
      '<span class="lesson-row__type">' + lesson.type + '</span>' +
      '<span class="lesson-row__lang">' + lesson.lang + '</span>';

    if (lesson.url) {
      var a = document.createElement('a');
      a.href = lesson.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'lesson-row ' + cls;
      a.innerHTML = content;
      list.appendChild(a);
    } else {
      var row = document.createElement('div');
      row.className = 'lesson-row ' + cls;
      row.innerHTML = content;
      list.appendChild(row);
    }
  });

  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

modalBackdrop.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

(function() {
  var timeline = document.getElementById('roadmap-timeline');
  var fill = document.getElementById('roadmap-fill');
  var pctEl = document.getElementById('roadmap-pct');
  if (!timeline) return;

  var totalLessons = 0;
  var totalDone = 0;

  PHASES.forEach(function(phase) {
    var total = phase.lessons.length;
    var done = phase.lessons.filter(function(l) { return l.status === 'complete'; }).length;
    totalLessons += total;
    totalDone += done;
    var pct = Math.round((done / total) * 100);

    var statusClass = phase.status === 'complete' ? 'rm--complete'
      : phase.status === 'in-progress' ? 'rm--progress'
      : 'rm--planned';

    var item = document.createElement('div');
    item.className = 'rm-item ' + statusClass;
    item.innerHTML =
      '<div class="rm-item__dot"></div>' +
      '<div class="rm-item__body">' +
        '<span class="rm-item__label">Phase ' + phase.id + '</span>' +
        '<span class="rm-item__name">' + phase.name + '</span>' +
        '<div class="rm-item__bar"><div class="rm-item__fill" style="width:' + pct + '%"></div></div>' +
        '<span class="rm-item__stat">' + done + '/' + total + '</span>' +
      '</div>';
    timeline.appendChild(item);
  });

  var globalPct = Math.round((totalDone / totalLessons) * 100);
  fill.style.width = globalPct + '%';
  pctEl.textContent = globalPct + '% complete';

  var subEl = document.getElementById('roadmap-sub');
  if (subEl) subEl.textContent = 'Track overall course completion. ' + totalDone + ' of ' + totalLessons + '+ lessons complete.';
})();

(function() {
  var grid = document.getElementById('glossary-grid');
  var search = document.getElementById('glossary-search');
  if (!grid) return;

  function render(terms) {
    grid.innerHTML = '';
    terms.forEach(function(t) {
      var card = document.createElement('div');
      card.className = 'gloss-card';
      card.innerHTML =
        '<h3 class="gloss-card__term">' + t.term + '</h3>' +
        '<div class="gloss-card__row">' +
          '<span class="gloss-card__label">What people say</span>' +
          '<p>"' + t.says + '"</p>' +
        '</div>' +
        '<div class="gloss-card__row">' +
          '<span class="gloss-card__label">What it actually means</span>' +
          '<p>' + t.means + '</p>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  render(GLOSSARY);

  search.addEventListener('input', function() {
    var q = search.value.toLowerCase();
    render(GLOSSARY.filter(function(t) {
      return t.term.toLowerCase().includes(q) ||
        t.says.toLowerCase().includes(q) ||
        t.means.toLowerCase().includes(q);
    }));
  });
})();

document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

(function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.fade-in, .phase-card, .diff__card, .how__step, .gloss-card, .rm-item').forEach(function(el) {
    if (!el.classList.contains('fade-in')) el.classList.add('fade-in');
    observer.observe(el);
  });
})();
