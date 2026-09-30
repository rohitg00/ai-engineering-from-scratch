/*
 * Projects section: the ladder catalog (projects.html) and the stage-by-stage
 * project workspace (project.html). Data comes from projects-data.js, built by
 * site/build-projects.js from projects/<id>/project.json. Stage lessons are the
 * markdown files in projects/<id>/stages/<stage>/docs/en.md.
 */
(function () {
  'use strict';

  var DATA = window.AIFS_PROJECTS || { levels: [], projects: [], planned: [] };
  var root = document.documentElement;
  var PROGRESS_KEY = 'aifs.projects.progress.v1';
  var SOURCE_KEY = 'aifs.projects.source.v1';
  var scriptVersion = document.currentScript ? new URL(document.currentScript.src, window.location.href).searchParams.get('v') : '';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function setTheme(preferred) {
    var stored = preferred || '';
    if (!stored) {
      try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
    }
    var theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    var icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'light' ? 'N' : 'D';
  }

  function initTheme() {
    setTheme();
    var button = document.getElementById('themeToggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('theme', next); } catch (_) {}
      setTheme(next);
    });
  }

  function progressFor(projectId) {
    var all = readStore(PROGRESS_KEY, {});
    return all[projectId] || {};
  }

  function setStageDone(projectId, stageId, done) {
    var all = readStore(PROGRESS_KEY, {});
    var entry = all[projectId] || {};
    if (done) entry[stageId] = new Date().toISOString().slice(0, 10);
    else delete entry[stageId];
    all[projectId] = entry;
    writeStore(PROGRESS_KEY, all);
  }

  function levelInfo(level) {
    for (var i = 0; i < DATA.levels.length; i++) if (DATA.levels[i].level === level) return DATA.levels[i];
    return { level: level, name: 'Level ' + level, summary: '' };
  }

  function repoFileUrl(path) {
    return (DATA.repo || 'https://github.com/rohitg00/ai-engineering-from-scratch') + '/blob/main/' + path;
  }

  function contentUrl(path) {
    return window.AIFSContentSource ? window.AIFSContentSource.repoUrl(path) : '../' + path;
  }

  function projectHref(id, stageId) {
    return 'project.html?id=' + encodeURIComponent(id) + (stageId ? '&stage=' + encodeURIComponent(stageId) : '');
  }

  function totalHours(project) {
    if (project.hours) return project.hours;
    return (project.stages || []).reduce(function (sum, s) { return sum + (s.hours || 0); }, 0);
  }

  function copyButton(text, label) {
    return '<button class="pj-copy" type="button" data-copy="' + esc(text) + '" aria-label="' + esc(label || 'Copy command') + '">Copy</button>';
  }

  function commandBlock(text, label, copyLabel) {
    return '<div class="pj-cmd-wrap"><div class="pj-cmd-toolbar"><span>' + esc(label || (text.charAt(0) === '/' ? 'Claude Code' : 'Terminal')) + '</span>' +
      copyButton(text, copyLabel) + '</div><pre class="pj-cmd"><code>' + esc(text) + '</code></pre></div>';
  }

  function enhanceCommands() {
    document.querySelectorAll('pre.pj-cmd').forEach(function (pre) {
      if (pre.closest('.pj-cmd-wrap')) return;
      var code = pre.querySelector('code');
      if (code) pre.outerHTML = commandBlock(code.textContent, pre.getAttribute('data-command-label'), pre.getAttribute('data-copy-label'));
    });
  }

  function fallbackCopy(text) {
    var focused = document.activeElement;
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand('copy');
    } finally {
      field.remove();
      if (focused && focused.focus) focused.focus({ preventScroll: true });
    }
  }

  function bindCopy(scope) {
    scope.addEventListener('click', async function (event) {
      var button = event.target.closest('.pj-copy');
      if (!button || button.dataset.copyPending === 'true') return;
      var text = button.getAttribute('data-copy');
      var block = button.closest('.pj-cmd-wrap, .pj-code');
      var status = block.querySelector('.pj-copy-status');
      if (!status) {
        status = document.createElement('span');
        status.className = 'pj-copy-status';
        status.setAttribute('role', 'status');
        block.appendChild(status);
      }
      clearTimeout(button.copyTimer);
      status.textContent = '';
      button.dataset.copyPending = 'true';
      var copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (_) {}
      if (!copied) {
        try { copied = fallbackCopy(text); } catch (_) {}
      }
      delete button.dataset.copyPending;
      button.textContent = copied ? 'Copied' : 'Copy';
      status.toggleAttribute('data-success', copied);
      status.textContent = copied ? 'Command copied.' : 'Copy unavailable. Select the command and copy it manually.';
      button.copyTimer = setTimeout(function () {
        button.textContent = 'Copy';
        if (copied) status.textContent = '';
      }, 1800);
    });
  }

  function inline(text, baseDir) {
    var codes = [];
    var out = String(text).replace(/`([^`]+)`/g, function (_, code) {
      codes.push('<code>' + esc(code) + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    out = esc(out);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      var url = href.replace(/&amp;/g, '&');
      var external = /^https?:\/\//.test(url);
      if (!external && !/^#/.test(url)) {
        if (/^phases\//.test(url)) url = 'lesson.html?path=' + url.replace(/\/$/, '');
        else url = repoFileUrl(normalizePath(baseDir + '/' + url));
      }
      return '<a href="' + esc(url) + '"' + (external || !/^lesson/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    return out.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codes[Number(i)]; });
  }

  function normalizePath(path) {
    var parts = [];
    path.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    return parts.join('/');
  }

  function renderTable(rows, baseDir) {
    var cells = rows.map(function (row) {
      return row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
    });
    var head = cells[0];
    var body = cells.slice(2);
    return '<div class="pj-table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c, baseDir) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + inline(c, baseDir) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderList(lines, baseDir) {
    var ordered = /^\s*\d+[.)]\s/.test(lines[0]);
    var items = [];
    lines.forEach(function (line) {
      var m = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (m && m[1].length < 2) items.push({ text: m[2], sub: [] });
      else if (m && items.length) items[items.length - 1].sub.push(line.replace(/^\s{2,4}/, ''));
      else if (items.length) items[items.length - 1].text += ' ' + line.trim();
    });
    var tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(function (item) {
      var task = item.text.match(/^\[( |x)\]\s+(.*)$/i);
      var body = task
        ? '<span class="pj-task' + (task[1] !== ' ' ? ' done' : '') + '" aria-hidden="true"></span>' + inline(task[2], baseDir)
        : inline(item.text, baseDir);
      return '<li>' + body + (item.sub.length ? renderList(item.sub, baseDir) : '') + '</li>';
    }).join('') + '</' + tag + '>';
  }

  function renderMarkdown(md, baseDir) {
    var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var i = 0;
    var title = '';
    var para = [];

    function flush() {
      if (para.length) html.push('<p>' + inline(para.join(' '), baseDir) + '</p>');
      para = [];
    }

    while (i < lines.length) {
      var line = lines[i];
      var fence = line.match(/^\s*```\s*([\w+-]*)/);
      if (fence) {
        flush();
        var lang = fence[1] || '';
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        i++;
        var text = code.join('\n');
        if (lang === 'figure') {
          html.push('<div class="lesson-figure" data-figure="' + esc(text.trim()) + '"></div>');
          continue;
        }
        var isCommand = /^(bash|sh|shell|console)$/.test(lang);
        html.push('<div class="pj-code' + (isCommand ? ' is-command' : '') + '">' + (lang ? '<span class="pj-code-lang">' + esc(lang) + '</span>' : '') +
          '<pre><code>' + esc(text) + '</code></pre>' + (isCommand ? copyButton(text.replace(/^\$\s*/gm, '')) : '') + '</div>');
        continue;
      }
      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flush();
        var depth = heading[1].length;
        if (depth === 1 && !title) { title = heading[2]; i++; continue; }
        var slug = heading[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        html.push('<h' + Math.max(depth, 2) + ' id="' + esc(slug) + '">' + inline(heading[2], baseDir) + '</h' + Math.max(depth, 2) + '>');
        i++;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        html.push(renderTable(rows, baseDir));
        continue;
      }
      if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line) && !/^\s*[-*_]{3,}\s*$/.test(line)) {
        flush();
        var block = [];
        while (i < lines.length && (/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length))) block.push(lines[i++]);
        html.push(renderList(block, baseDir));
        continue;
      }
      if (/^>\s?/.test(line)) {
        flush();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
        if (!html.length && !para.length && title) html.push('<p class="pj-hook">' + inline(quote.join(' '), baseDir) + '</p>');
        else html.push('<blockquote>' + inline(quote.join(' '), baseDir) + '</blockquote>');
        continue;
      }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flush(); html.push('<hr>'); i++; continue; }
      if (!line.trim()) { flush(); i++; continue; }
      if (/^\*\*(Type|Languages|Language|Stage|Time|Prerequisites):\*\*/.test(line)) { flush(); i++; continue; }
      para.push(line.trim());
      i++;
    }
    flush();
    return { title: title, html: html.join('\n') };
  }

  function sourceBadge(item) {
    if (item.source === 'community') {
      var handle = item.author && item.author.github ? '@' + item.author.github : 'community';
      return '<span class="pj-badge community">' + esc(handle) + '</span>';
    }
    return '<span class="pj-badge core">core</span>';
  }

  function projectCard(project) {
    var done = project.stages.filter(function (stage) { return !!progressFor(project.id)[stage.id]; }).length;
    var total = project.stages.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    return '<a class="pj-card is-ready" href="' + projectHref(project.id) + '">' +
      '<div class="pj-card-top">' + sourceBadge(project) + '<span class="pj-card-meta">' + total + ' stages · ~' + totalHours(project) + 'h</span></div>' +
      '<h3>' + esc(project.title) + '</h3>' +
      '<p>' + esc(project.tagline || project.summary || '') + '</p>' +
      languageChips(project.languages) +
      '<div class="pj-card-foot"><div class="pj-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '<span>' + (done ? done + ' of ' + total + ' done' : 'Start') + '</span></div></a>';
  }

  function plannedCard(item) {
    return '<div class="pj-card is-planned">' +
      '<div class="pj-card-top"><span class="pj-badge planned">planned</span>' + (item.ours ? '<span class="pj-badge ours">rebuild of our repo</span>' : '') + '</div>' +
      '<h3>' + esc(item.title) + '</h3><p>' + esc(item.tagline || '') + '</p>' +
      languageChips(item.languages) + '</div>';
  }

  function languageChips(languages) {
    if (!languages || !languages.length) return '';
    return '<div class="pj-langs">' + languages.map(function (l) {
      return '<span class="pj-lang" data-lang="' + esc(String(l).toLowerCase()) + '">' + esc(l) + '</span>';
    }).join('') + '</div>';
  }

  function stageLanguages(stage) {
    return String(stage.language || '').split('+').filter(Boolean).map(function (l) {
      var key = l.trim().toLowerCase();
      return key === 'typescript' ? 'TypeScript' : key.charAt(0).toUpperCase() + key.slice(1);
    });
  }

  function demoFigure(demo, baseDir) {
    function asset(file) { return baseDir.indexOf('project-content/') === 0 ? baseDir + '/' + file : contentUrl(normalizePath(baseDir + '/' + file)); }
    var media;
    var play = '';
    if (demo.video) {
      media = '<video controls preload="metadata"' + (demo.poster ? ' poster="' + esc(asset(demo.poster)) + '"' : '') + ' aria-label="' + esc(demo.title || 'Project demo') + '"><source src="' + esc(asset(demo.video)) + '"></video>';
    } else {
      var src = asset(demo.gif);
      media = '<img src="' + esc(demo.poster ? asset(demo.poster) : src) + '" data-gif="' + esc(src) + '" alt="' + esc(demo.alt || demo.title || 'Project demo') + '" loading="lazy">';
      if (demo.poster) play = '<button type="button" class="pj-chip pj-demo-play" data-poster="' + esc(asset(demo.poster)) + '">Play recording</button>';
    }
    return '<figure class="pj-demo"><div class="pj-demo-frame"><div class="pj-demo-bar"><span></span><span></span><span></span><em>' + esc(demo.title || 'Demo') + '</em></div>' + media + '</div>' + play +
      (demo.caption ? '<figcaption>' + esc(demo.caption) + '</figcaption>' : '') + '</figure>';
  }

  function mountFigures(root) {
    if (typeof window.mountLessonFigures === 'function') window.mountLessonFigures(root);
  }

  function renderCatalog() {
    var ladder = document.getElementById('pjLadder');
    var stats = document.getElementById('pjStats');
    var filter = document.getElementById('pjSourceFilter');
    var showPlanned = document.getElementById('pjShowPlanned');
    if (!ladder) return;

    var community = DATA.projects.filter(function (p) { return p.source === 'community'; }).length;
    stats.innerHTML = [
      [DATA.projects.length, 'ready to build'],
      [DATA.planned.length, 'on the roadmap'],
      [DATA.levels.length, 'levels'],
      [community, 'from the community'],
    ].map(function (s) { return '<div><strong>' + s[0] + '</strong><span>' + s[1] + '</span></div>'; }).join('');

    var first = DATA.projects[0];
    var start = document.getElementById('pjStartLink');
    if (first && start) start.href = projectHref(first.id);

    var sources = [['all', 'All'], ['core', 'Core'], ['community', 'Community']];
    var current = readStore(SOURCE_KEY, 'all');
    if (!sources.some(function (s) { return s[0] === current; })) current = 'all';

    function draw() {
      filter.innerHTML = sources.map(function (s) {
        return '<button type="button" class="pj-chip' + (s[0] === current ? ' is-active' : '') + '" data-source="' + s[0] + '" aria-pressed="' + (s[0] === current) + '">' + s[1] + '</button>';
      }).join('');
      var include = function (item) { return current === 'all' || item.source === current; };
      ladder.innerHTML = DATA.levels.map(function (level) {
        var ready = DATA.projects.filter(function (p) { return p.level === level.level && include(p); });
        var planned = showPlanned.checked ? DATA.planned.filter(function (p) { return p.level === level.level && include(p); }) : [];
        var cards = ready.map(projectCard).join('') + planned.map(plannedCard).join('');
        if (!cards) {
          cards = current === 'community'
            ? '<div class="pj-empty">No community projects at this level yet. <a href="#submit">Be the first.</a></div>'
            : '<div class="pj-empty">Nothing here yet.</div>';
        }
        return '<section class="pj-level" aria-label="Level ' + level.level + '">' +
          '<header class="pj-level-head"><div class="pj-level-n">' + level.level + '</div><div><h3>' + esc(level.name) + '</h3><p>' + esc(level.summary) + '</p></div></header>' +
          '<div class="pj-level-cards">' + cards + '</div></section>';
      }).join('');
    }

    filter.addEventListener('click', function (event) {
      var button = event.target.closest('[data-source]');
      if (!button) return;
      current = button.getAttribute('data-source');
      writeStore(SOURCE_KEY, current);
      draw();
    });
    showPlanned.addEventListener('change', draw);
    draw();
  }

  function loadFigures(project) {
    var scripts = project.figureScripts || [];
    if (!scripts.length && project.figures) scripts = ['figures/projects/' + encodeURIComponent(project.id) + '.js'];
    return scripts.reduce(function (previous, source) {
      return previous.then(function () {
        return new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = source + (scriptVersion ? (source.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(scriptVersion) : '');
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      });
    }, Promise.resolve());
  }

  async function renderProject() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id') || '';
    var project = DATA.projects.filter(function (p) { return p.id === id; })[0];
    var hero = document.getElementById('pjProjectHero');
    if (!project) {
      hero.innerHTML = '<div class="pj-eyebrow">PROJECT NOT FOUND</div><h1>Pick a project from the ladder.</h1><p><a class="pj-action" href="projects.html">All projects</a></p>';
      return;
    }
    try { await loadFigures(project); } catch (_) { console.warn('Project figures could not load'); }
    document.title = project.title + ' - Projects - AI Engineering from Scratch';
    document.getElementById('pjCrumb').textContent = project.title;
    var level = levelInfo(project.level);

    var prereqs = (project.prerequisites || []).map(function (p) {
      return '<li><a href="lesson.html?path=' + esc(p.path) + '">' + esc(p.title) + '</a></li>';
    }).join('');
    var why = project.languageWhy || {};
    (project.languageReasons || []).forEach(function (item) { why[item.language] = item.why; });
    var whyHtml = Object.keys(why).map(function (lang) {
      return '<li><span class="pj-lang" data-lang="' + esc(lang.toLowerCase()) + '">' + esc(lang) + '</span> ' + esc(why[lang]) + '</li>';
    }).join('');
    var useful = (project.usefulFor || []).map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('');
    var skills = (project.skills || []).map(function (s) { return '<span class="pj-skill">' + esc(s) + '</span>'; }).join('');

    hero.innerHTML =
      '<div class="pj-hero-grid"><div>' +
        '<div class="pj-eyebrow">LEVEL ' + project.level + ' · ' + esc(level.name.toUpperCase()) + '</div>' +
        '<h1>' + esc(project.title) + '</h1>' +
        '<p class="pj-lede">' + esc(project.summary || project.tagline || '') + '</p>' +
        '<div class="pj-meta-row"><span>' + project.stages.length + ' stages</span><span>~' + totalHours(project) + ' hours</span><span>' + esc((project.languages || []).join(', ')) + '</span>' + sourceBadge(project) + '</div>' +
        (skills ? '<div class="pj-skills">' + skills + '</div>' : '') +
      '</div><div class="pj-hero-side">' +
        (project.youWillBuild ? '<div class="pj-side-block"><div class="pj-eyebrow">YOU END UP WITH</div><p>' + esc(project.youWillBuild) + '</p></div>' : '') +
        (useful ? '<div class="pj-side-block"><div class="pj-eyebrow">USEFUL FOR</div><ul>' + useful + '</ul></div>' : '') +
        (prereqs ? '<div class="pj-side-block"><div class="pj-eyebrow">LEARN FIRST</div><ul>' + prereqs + '</ul></div>' : '') +
        (whyHtml ? '<div class="pj-side-block"><div class="pj-eyebrow">WHY THESE LANGUAGES</div><ul class="pj-why">' + whyHtml + '</ul></div>' : '') +
      '</div></div>';

    var overview = document.getElementById('pjOverview');
    var demos = (project.demos || []).map(function (d) { return demoFigure(d, project.contentBase || project.path); }).join('');
    if (overview && (project.overviewFigure || demos)) {
      overview.hidden = false;
      overview.innerHTML =
        '<details class="pj-context"><summary>Project overview and recordings</summary><div class="pj-context-body">' +
        (project.overviewFigure ? '<div class="pj-overview-fig"><div class="pj-eyebrow">PROJECT OVERVIEW</div><p class="pj-small">This example introduces the project. The selected lesson has its own mechanism.</p><div class="lesson-figure" data-figure="' + esc(project.overviewFigure) + '"></div></div>' : '') +
        (demos ? '<div class="pj-demos"><div class="pj-eyebrow">PROJECT RECORDINGS</div><div class="pj-demo-grid">' + demos + '</div></div>' : '') + '</div></details>';
      document.getElementById('pjWorkspace').insertAdjacentElement('afterend', overview);
      var context = overview.querySelector('details');
      context.addEventListener('toggle', function () { if (context.open) mountFigures(overview); });
    }

    document.getElementById('pjWorkspace').hidden = false;
    document.getElementById('pjTutorCard').innerHTML =
      '<div class="pj-eyebrow">LEARN WITH THE TUTOR</div><p>In Claude Code, run:</p>' +
      commandBlock('/build-project ' + project.id) +
      '<p class="pj-small">In Codex or another compatible agent, ask it to use the build-project skill for this project. One stage per session: predict, build, test, reflect.</p>';

    var certificateHost = document.getElementById('pjCertificate');
    if (certificateHost && window.AIFSProjectCertificates) window.AIFSProjectCertificates.mount(certificateHost, project);

    var requested = params.get('stage');
    var stageIndex = Math.max(0, project.stages.findIndex(function (s) { return s.id === requested; }));
    if (!requested) {
      var progress = progressFor(project.id);
      var next = project.stages.findIndex(function (s) { return !progress[s.id]; });
      stageIndex = next === -1 ? 0 : next;
    }

    function drawRail() {
      var progress = progressFor(project.id);
      var done = project.stages.filter(function (s) { return progress[s.id]; }).length;
      var pct = Math.round((done / project.stages.length) * 100);
      document.getElementById('pjProgress').innerHTML =
        '<div class="pj-progress-head"><span>Your progress</span><strong>' + done + ' / ' + project.stages.length + '</strong></div>' +
        '<div class="pj-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
        '<p class="pj-small">Self-reported progress, saved in this browser. Import grader evidence below for a certificate.</p>';
      document.getElementById('pjStageList').innerHTML = project.stages.map(function (stage, index) {
        var isDone = !!progress[stage.id];
        return '<li><a href="' + projectHref(project.id, stage.id) + '" data-stage-index="' + index + '" class="pj-stage-link' +
          (index === stageIndex ? ' is-current' : '') + (isDone ? ' is-done' : '') + '"' + (index === stageIndex ? ' aria-current="step"' : '') + '>' +
          '<span class="pj-stage-n">' + (isDone ? '✓' : stage.number) + '</span>' +
          '<span class="pj-stage-text"><span class="pj-stage-title">' + esc(stage.title) + '</span>' +
          '<span class="pj-stage-sub">' + esc(stage.difficulty || '') + (stage.hours ? ' · ~' + stage.hours + 'h' : '') + (stageLanguages(stage).length ? ' · ' + esc(stageLanguages(stage).join(' + ')) : '') + '</span></span></a></li>';
      }).join('');
    }

    var requestVersion = 0;
    function drawStage() {
      var version = ++requestVersion;
      var stage = project.stages[stageIndex];
      var mount = document.getElementById('pjStage');
      var baseDir = stage.doc.replace(/\/[^/]+$/, '');
      var prev = project.stages[stageIndex - 1];
      var next = project.stages[stageIndex + 1];
      var isDone = !!progressFor(project.id)[stage.id];
      var testCmd = 'python3 scripts/project_test.py ' + project.id + ' --stage ' + stage.number + ' --path my-' + project.id;

      if (window.AIFSFigureRuntime) window.AIFSFigureRuntime.disposeRoot(mount);
      mount.innerHTML =
        '<header class="pj-stage-head"><div class="pj-eyebrow">STAGE ' + stage.number + ' OF ' + project.stages.length + ' · ' + esc((stage.difficulty || '').toUpperCase()) + '</div>' +
        '<h2 id="pjStageTitle">' + esc(stage.title) + '</h2><p class="pj-lede">' + esc(stage.summary || '') + '</p>' +
        languageChips(stageLanguages(stage)) +
        ((stage.concepts || []).length ? '<div class="pj-skills">' + stage.concepts.map(function (c) { return '<span class="pj-skill">' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
        '</header>' +
        '<div class="pj-run-card"><div><div class="pj-eyebrow">RUN THIS STAGE</div>' +
          (stage.number === 1 ? commandBlock('python3 scripts/project_test.py ' + project.id + ' --init my-' + project.id) : '') +
          commandBlock(testCmd) + '</div></div>' +
        '<div class="pj-doc" id="pjDoc"><p class="pj-loading">Loading the lesson…</p></div>' +
        (stage.demo ? '<details class="pj-context pj-stage-recording"><summary>Watch the stage ' + stage.number + ' recording</summary>' + demoFigure(stage.demo, project.contentBase || project.path) + '</details>' : '') +
        '<footer class="pj-stage-foot">' +
          '<button type="button" class="pj-action' + (isDone ? ' secondary' : '') + '" id="pjToggleDone">' + (isDone ? 'Mark as not done' : 'Mark stage complete') + '</button>' +
          '<div class="pj-stage-nav">' +
            (prev ? '<a class="pj-action secondary" href="' + projectHref(project.id, prev.id) + '" data-stage-index="' + (stageIndex - 1) + '">← ' + esc(prev.title) + '</a>' : '') +
            (next ? '<a class="pj-action secondary" href="' + projectHref(project.id, next.id) + '" data-stage-index="' + (stageIndex + 1) + '">' + esc(next.title) + ' →</a>' : '') +
          '</div>' +
          '<a class="pj-source-link" href="' + esc(repoFileUrl(stage.doc)) + '" target="_blank" rel="noopener">View this lesson on GitHub</a>' +
        '</footer>';

      document.getElementById('pjToggleDone').addEventListener('click', function () {
        setStageDone(project.id, stage.id, !progressFor(project.id)[stage.id]);
        drawRail();
        drawStage();
      });

      fetch(stage.contentUrl || contentUrl(stage.doc)).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      }).then(function (md) {
        if (version !== requestVersion) return;
        var rendered = renderMarkdown(md, baseDir);
        var docEl = document.getElementById('pjDoc');
        docEl.innerHTML = rendered.html;
        mountFigures(docEl);
      }).catch(function () {
        if (version !== requestVersion) return;
        document.getElementById('pjDoc').innerHTML = '<p>Could not load this lesson. <a href="' + esc(repoFileUrl(stage.doc)) + '" target="_blank" rel="noopener">Read it on GitHub</a>.</p>';
      });
    }

    function go(index, push) {
      stageIndex = index;
      if (push) history.pushState({ stage: index }, '', projectHref(project.id, project.stages[index].id));
      drawRail();
      drawStage();
      var title = document.getElementById('pjStageTitle');
      if (push && title) title.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }

    document.getElementById('pjWorkspace').addEventListener('click', function (event) {
      var link = event.target.closest('[data-stage-index]');
      if (!link || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      go(Number(link.getAttribute('data-stage-index')), true);
    });
    window.addEventListener('popstate', function () {
      var s = new URLSearchParams(window.location.search).get('stage');
      var idx = project.stages.findIndex(function (st) { return st.id === s; });
      go(idx === -1 ? 0 : idx, false);
    });

    go(stageIndex, false);
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.pj-demo-play');
    if (!button) return;
    var img = button.closest('figure').querySelector('img');
    var playing = button.getAttribute('aria-pressed') === 'true';
    img.src = playing ? button.getAttribute('data-poster') : img.getAttribute('data-gif');
    button.setAttribute('aria-pressed', String(!playing));
    button.textContent = playing ? 'Play recording' : 'Stop recording';
  });

  enhanceCommands();
  bindCopy(document.getElementById('main'));
  initTheme();
  var page = document.body.getAttribute('data-projects-page');
  if (page === 'catalog') renderCatalog();
  if (page === 'project') renderProject();

  window.AIFSProjectsMarkdown = renderMarkdown;
})();
