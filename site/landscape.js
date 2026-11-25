(function () {
  'use strict';

  var data = window.LANDSCAPE || { categories: [], entries: [], repo: '' };
  var rules = window.LandscapeRules;
  var state = { query: '', license: 'all', category: 'all', view: 'grid' };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function matches(entry) {
    if (state.license === 'open' && !entry.open_source) return false;
    if (state.license === 'closed' && entry.open_source) return false;
    if (state.category !== 'all' && entry.categories.indexOf(state.category) === -1) return false;
    if (!state.query) return true;
    var haystack = (entry.name + ' ' + entry.description + ' ' + (entry.x || '')).toLowerCase();
    return haystack.indexOf(state.query) !== -1;
  }

  function categoryById(id) {
    return data.categories.filter(function (category) { return category.id === id; })[0];
  }

  function licenseBadge(entry) {
    return el('span', entry.open_source ? 'ls-badge ls-badge-open' : 'ls-badge', entry.open_source ? 'Open source' : 'Closed source');
  }

  function logoImage(entry) {
    var image = el('img');
    image.alt = '';
    image.setAttribute('data-src', entry.logo);
    if (entry.pack) image.setAttribute('data-pack', entry.pack.join(','));
    return image;
  }

  function pressOnly(buttons, pressed) {
    Array.prototype.forEach.call(buttons, function (button) {
      button.setAttribute('aria-pressed', String(button === pressed));
    });
  }

  function tile(entry) {
    var link = el('a', entry.featured ? 'ls-tile ls-tile-pinned' : 'ls-tile');
    link.setAttribute('data-slug', entry.slug);
    link.href = entry.url;
    link.target = '_blank';
    link.rel = 'nofollow noopener';
    link.title = entry.name + ': ' + entry.description;

    var plate = el('span', 'ls-plate');
    if (entry.logo) {
      var image = logoImage(entry);
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 48;
      image.height = 48;
      plate.appendChild(image);
    } else {
      plate.classList.add('ls-plate-pending');
      plate.textContent = entry.name.slice(0, 1).toUpperCase();
    }
    link.appendChild(plate);

    var body = el('span', 'ls-tile-body');
    body.appendChild(el('span', 'ls-name', entry.name));
    body.appendChild(el('span', 'ls-description', entry.description));
    var meta = el('span', 'ls-meta');
    meta.appendChild(licenseBadge(entry));
    if (entry.x) meta.appendChild(el('span', 'ls-handle', '@' + entry.x));
    body.appendChild(meta);
    if (entry.sponsor) link.appendChild(el('span', 'ls-sponsor-tag', 'Sponsor'));
    link.appendChild(body);
    return link;
  }

  var logoObserver = null;
  var packCache = {};
  var logoUrls = {};

  function fetchPack(index) {
    if (!packCache[index]) {
      packCache[index] = fetch(data.packs[index]).then(function (response) {
        if (!response.ok) throw new Error('pack ' + index);
        return response.arrayBuffer();
      });
    }
    return packCache[index];
  }

  function showLogo(image) {
    var source = image.getAttribute('data-src');
    var pack = image.getAttribute('data-pack');
    image.removeAttribute('data-src');
    if (!pack || !data.packs || !window.Blob || !window.URL) {
      image.src = source;
      return;
    }
    if (logoUrls[source]) {
      image.src = logoUrls[source];
      return;
    }
    var parts = pack.split(',').map(Number);
    fetchPack(parts[0]).then(function (buffer) {
      if (!logoUrls[source]) {
        var type = /\.svg$/.test(source) ? 'image/svg+xml' : 'image/png';
        logoUrls[source] = URL.createObjectURL(new Blob([buffer.slice(parts[1], parts[1] + parts[2])], { type: type }));
      }
      image.src = logoUrls[source];
    }, function () {
      image.src = source;
    });
  }

  function loadLogos(section) {
    var pending = section.querySelectorAll('img[data-src]');
    for (var i = 0; i < pending.length; i++) showLogo(pending[i]);
  }

  function watchLogos(sections) {
    if (logoObserver) logoObserver.disconnect();
    if (!('IntersectionObserver' in window)) {
      sections.forEach(loadLogos);
      return;
    }
    logoObserver = new IntersectionObserver(function (records) {
      records.forEach(function (record) {
        if (!record.isIntersecting) return;
        loadLogos(record.target);
        logoObserver.unobserve(record.target);
      });
    }, { rootMargin: '700px 0px' });
    sections.forEach(function (section) { logoObserver.observe(section); });
  }

  function renderGrid() {
    var grid = document.getElementById('landscapeGrid');
    var count = document.getElementById('landscapeCount');
    if (!grid) return;
    grid.textContent = '';
    var shown = 0;
    var lastGroup = '';
    var row = null;
    var filtering = state.query || state.license !== 'all';

    data.categories.forEach(function (category) {
      if (state.category !== 'all' && state.category !== category.id) return;
      var all = data.entries.filter(function (entry) { return entry.categories.indexOf(category.id) !== -1; });
      var visible = all.filter(matches);
      if (filtering && !visible.length) return;
      shown += visible.length;

      if (category.group !== lastGroup) {
        lastGroup = category.group;
        var wrap = el('section', 'ls-groupwrap');
        wrap.id = 'group-' + rules.slugify(category.group);
        var rail = el('div', 'ls-rail');
        var label = el('h2', 'ls-group', category.group);
        rail.appendChild(label);
        wrap.appendChild(rail);
        row = el('div', 'ls-row-wrap');
        wrap.appendChild(row);
        var groupTotal = data.entries.filter(function (entry) {
          return matches(entry) && data.categories.some(function (other) { return other.group === category.group && entry.categories.indexOf(other.id) !== -1; });
        }).length;
        label.appendChild(el('span', 'ls-group-count', String(groupTotal)));
        grid.appendChild(wrap);
      }

      var section = el('section', 'ls-category');
      section.id = 'category-' + category.id;
      var pinnedCount = visible.filter(function (entry) { return entry.featured; }).length;
      section.style.setProperty('--ls-weight', String(Math.min(Math.max(visible.length + pinnedCount * 3, 3), 26)));
      var head = el('div', 'ls-category-head');
      var title = el('h3');
      title.title = category.name + ': ' + category.summary;
      title.appendChild(el('span', 'ls-category-name', category.name));
      head.appendChild(title);
      head.appendChild(el('span', 'ls-category-count', String(visible.length)));
      var learn = el('a', 'ls-learn', 'Learn');
      learn.title = 'Lessons that teach how this kind of tool works';
      learn.href = category.learn;
      head.appendChild(learn);
      section.appendChild(head);
      section.appendChild(el('p', 'ls-category-summary', category.summary));

      var tiles = el('div', 'ls-tiles');
      visible.forEach(function (entry) { tiles.appendChild(tile(entry)); });
      if (!all.length) {
        var empty = el('a', 'ls-empty', 'No tools listed yet. Add the first one.');
        empty.href = '#add';
        empty.addEventListener('click', function () { selectFormCategory(category.id); });
        tiles.appendChild(empty);
      }
      section.appendChild(tiles);
      row.appendChild(section);
    });

    if (!shown && filtering) {
      grid.appendChild(el('p', 'ls-no-results', 'No tools match these filters.'));
    }
    if (count) count.textContent = data.entries.filter(matches).length + ' of ' + data.entries.length + ' tools';
    watchLogos(Array.prototype.slice.call(grid.querySelectorAll('.ls-category')));
  }

  function renderFilters() {
    var chips = document.getElementById('landscapeCategories');
    if (!chips) return;
    chips.textContent = '';
    var select = el('select', 'ls-select');
    select.id = 'landscapeCategory';
    select.setAttribute('aria-label', 'Category');
    var every = el('option', '', 'All ' + data.categories.length + ' categories');
    every.value = 'all';
    select.appendChild(every);
    var groups = {};
    data.categories.forEach(function (category) {
      if (!groups[category.group]) {
        groups[category.group] = el('optgroup');
        groups[category.group].label = category.group;
        select.appendChild(groups[category.group]);
      }
      var option = el('option', '', category.name);
      option.value = category.id;
      groups[category.group].appendChild(option);
    });
    select.value = state.category;
    select.addEventListener('change', function () {
      state.category = select.value;
      renderGrid();
    });
    chips.appendChild(select);
  }

  function bindFilters() {
    var search = document.getElementById('landscapeSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value.trim().toLowerCase();
        renderGrid();
      });
    }
    var views = document.querySelectorAll('[data-view][aria-pressed]');
    Array.prototype.forEach.call(views, function (button) {
      button.addEventListener('click', function () {
        state.view = button.getAttribute('data-view');
        pressOnly(views, button);
        document.getElementById('landscapeGrid').setAttribute('data-view', state.view);
      });
    });
    var license = document.querySelectorAll('[data-license]');
    Array.prototype.forEach.call(license, function (button) {
      button.addEventListener('click', function () {
        state.license = button.getAttribute('data-license');
        pressOnly(license, button);
        renderGrid();
      });
    });
  }

  function detailRow(label, node) {
    var line = el('div', 'ls-detail-row');
    line.appendChild(el('dt', '', label));
    var value = el('dd');
    value.appendChild(node);
    line.appendChild(value);
    return line;
  }

  function outLink(href, text) {
    var link = el('a', '', text);
    link.href = href;
    link.target = '_blank';
    link.rel = 'nofollow noopener';
    return link;
  }

  function showCategory(id) {
    if (state.category !== 'all') state.category = id;
    var select = document.getElementById('landscapeCategory');
    if (select) select.value = state.category;
    state.query = '';
    var search = document.getElementById('landscapeSearch');
    if (search) search.value = '';
    state.license = 'all';
    var license = document.querySelectorAll('[data-license]');
    Array.prototype.forEach.call(license, function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-license') === 'all'));
    });
    renderGrid();
    if (history.pushState) history.pushState(null, '', '#category-' + id);
    var section = document.getElementById('category-' + id);
    if (section) section.scrollIntoView();
  }

  function openDetail(entry) {
    var dialog = document.getElementById('landscapeDetail');
    if (!dialog || !dialog.showModal) return false;
    var category = categoryById(entry.category);
    var logo = document.getElementById('detailLogo');
    logo.textContent = '';
    if (entry.logo) {
      var image = logoImage(entry);
      logo.appendChild(image);
      showLogo(image);
    } else {
      logo.textContent = entry.name.slice(0, 1).toUpperCase();
    }
    document.getElementById('detailName').textContent = entry.name;
    document.getElementById('detailDescription').textContent = entry.description;
    var badges = document.getElementById('detailBadges');
    badges.textContent = '';
    badges.appendChild(licenseBadge(entry));
    if (entry.sponsor) badges.appendChild(el('span', 'ls-badge ls-badge-sponsor', 'Sponsor'));
    var list = document.getElementById('detailList');
    list.textContent = '';
    var categoryLinks = el('span', 'ls-detail-cats');
    entry.categories.forEach(function (id) {
      var item = categoryById(id);
      var categoryLink = el('a', '', item.name);
      categoryLink.href = '#category-' + item.id;
      categoryLink.addEventListener('click', function (event) {
        dialog.close();
        if (document.getElementById('category-' + item.id)) return;
        event.preventDefault();
        showCategory(item.id);
      });
      categoryLinks.appendChild(categoryLink);
    });
    list.appendChild(detailRow(entry.categories.length > 1 ? 'Categories' : 'Category', categoryLinks));
    list.appendChild(detailRow('Group', document.createTextNode(category.group)));
    list.appendChild(detailRow('Website', outLink(entry.url, entry.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))));
    if (entry.repo) list.appendChild(detailRow('Source', outLink(entry.repo, entry.repo.replace(/^https:\/\//, ''))));
    if (entry.x) list.appendChild(detailRow('X', outLink('https://x.com/' + entry.x, '@' + entry.x)));
    var learn = el('a', '', 'Lessons for this category');
    learn.href = category.learn;
    list.appendChild(detailRow('Learn', learn));
    var visit = document.getElementById('detailVisit');
    visit.href = entry.url;
    var edit = document.getElementById('detailEdit');
    edit.href = 'https://github.com/' + data.repo + '/blob/main/' + rules.entryPath(entry.slug);
    if (history.replaceState) history.replaceState(null, '', '#tool=' + entry.slug);
    dialog.showModal();
    return true;
  }

  function bindDetail() {
    var dialog = document.getElementById('landscapeDetail');
    var grid = document.getElementById('landscapeGrid');
    if (!dialog || !grid) return;
    var bySlug = {};
    data.entries.forEach(function (entry) { bySlug[entry.slug] = entry; });
    grid.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var node = event.target.closest ? event.target.closest('.ls-tile') : null;
      if (!node) return;
      var entry = bySlug[node.getAttribute('data-slug')];
      if (entry && openDetail(entry)) event.preventDefault();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    document.getElementById('detailClose').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      if (/^#tool=/.test(location.hash) && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
    var linked = /^#tool=([a-z0-9-]+)$/.exec(location.hash);
    if (linked && bySlug[linked[1]]) openDetail(bySlug[linked[1]]);
  }

  function bindZoom() {
    var sizes = [52, 60, 68, 80, 96, 116];
    var index = 2;
    try { index = Number(localStorage.getItem('landscape:zoom') || 2); } catch (_) {}
    if (!(index >= 0 && index < sizes.length)) index = 2;
    function apply() {
      document.body.style.setProperty('--ls-tile', sizes[index] + 'px');
      try { localStorage.setItem('landscape:zoom', String(index)); } catch (_) {}
    }
    var out = document.getElementById('zoomOut');
    var into = document.getElementById('zoomIn');
    if (!out || !into) return;
    out.addEventListener('click', function () { index = Math.max(0, index - 1); apply(); });
    into.addEventListener('click', function () { index = Math.min(sizes.length - 1, index + 1); apply(); });
    if (index !== 2 && window.matchMedia('(min-width: 641px)').matches) apply();
  }

  function selectFormCategory(id) {
    var select = document.getElementById('addCategory');
    if (select) {
      select.value = id;
      updateForm();
    }
  }

  function formValues() {
    function value(id) {
      var node = document.getElementById(id);
      return node ? node.value : '';
    }
    var open = document.getElementById('addOpenSource');
    return {
      name: value('addName'),
      url: value('addUrl'),
      category: value('addCategory'),
      description: value('addDescription'),
      open_source: Boolean(open && open.checked),
      repo: value('addRepo'),
      x: value('addX'),
      logo_url: value('addLogoUrl')
    };
  }

  var FORM_LABELS = { name: 'Tool name', url: 'Website', category: 'Category', description: 'Description', repo: 'Source repository', logo_url: 'Link to your logo', x: 'X account' };

  function formProblem(problem) {
    if (/^give "logo_url"/.test(problem)) return 'Link to your logo is required';
    return problem.replace(/^"([a-z_]+)"/, function (match, field) { return FORM_LABELS[field] || match; });
  }

  function updateForm() {
    var form = document.getElementById('addForm');
    if (!form || !rules) return;
    var values = formValues();
    var entry = rules.buildEntry(values);
    var slug = rules.slugify(entry.name);
    var categoryIds = data.categories.map(function (category) { return category.id; });
    var errors = rules.validateEntry(slug || 'your-tool', entry, categoryIds);
    var taken = data.entries.some(function (existing) { return existing.slug === slug; });
    if (taken) errors.unshift('"' + entry.name + '" is already listed. Open its file on GitHub to change it.');

    document.getElementById('addRepoRow').hidden = !values.open_source;
    document.getElementById('addCounter').textContent = entry.description.length + ' / ' + rules.MAX_DESCRIPTION;
    document.getElementById('addPath').textContent = slug ? rules.entryPath(slug) : rules.ENTRY_DIR + '/your-tool.json';
    document.getElementById('addPreview').textContent = rules.entryJson(entry);

    var touched = form.getAttribute('data-touched') === 'true';
    var list = document.getElementById('addErrors');
    list.textContent = '';
    if (touched) errors.forEach(function (problem) { list.appendChild(el('li', '', formProblem(problem))); });
    var status = document.getElementById('addStatus');
    if (status) status.textContent = errors.length ? 'The button turns on when the form has no problems. ' + errors.length + ' left.' : 'Ready. GitHub opens in a new tab.';

    var submit = document.getElementById('addSubmit');
    var ready = errors.length === 0;
    submit.setAttribute('aria-disabled', String(!ready));
    submit.href = ready ? rules.pullRequestUrl(slug, entry) : '#add';
  }

  function bindForm() {
    var form = document.getElementById('addForm');
    if (!form || !rules) return;
    var select = document.getElementById('addCategory');
    data.categories.forEach(function (category) {
      var option = el('option', '', category.name);
      option.value = category.id;
      select.appendChild(option);
    });
    form.addEventListener('input', function () {
      form.setAttribute('data-touched', 'true');
      updateForm();
    });
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    document.getElementById('addSubmit').addEventListener('click', function (event) {
      if (this.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        form.setAttribute('data-touched', 'true');
        updateForm();
      }
    });
    copyButton('addCopy', function () { return document.getElementById('addPreview').textContent; });
    copyButton('addPrompt', agentPrompt);
    updateForm();
  }

  function copyButton(id, text) {
    var button = document.getElementById(id);
    var label = button.textContent;
    button.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text()).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = label; }, 1600);
      });
    });
  }

  function agentPrompt() {
    var name = document.getElementById('addName').value.trim();
    var lines = [
      'Add ' + (name ? 'the tool "' + name + '"' : 'my tool') + ' to the AI Engineering Landscape.',
      '',
      'Repository: https://github.com/' + rules.REPO,
      '',
      '1. Read landscape/README.md for the fields and the listing rules. Read landscape/categories.json for the category ids.',
      '2. Fork the repository and make a branch.',
      '3. Create ' + rules.ENTRY_DIR + '/<slug>.json. The slug is the tool name in lowercase letters, digits and hyphens.',
      '4. Fill in name, url, category, description, open_source, repo (open source tools only) and logo_url (an https link to an SVG or PNG logo). The description is one sentence of ' + rules.MAX_DESCRIPTION + ' characters or fewer, ends with a period, and has no promotional words.',
      '5. Run "node site/build-landscape.js --check" and fix every problem it reports.',
      '6. Open a pull request against main that adds only that one file.',
      '',
      'Ask me for any detail you cannot find on the tool website. Do not guess.'
    ];
    if (name) {
      lines.push('', 'Start from this draft of ' + document.getElementById('addPath').textContent + ':', '', document.getElementById('addPreview').textContent);
    }
    return lines.join('\n');
  }

  function renderStat() {
    var stat = document.getElementById('landscapeStat');
    if (!stat) return;
    var open = data.entries.filter(function (entry) { return entry.open_source; }).length;
    [[data.entries.length, 'Tools'], [data.categories.length, 'Categories'], [open, 'Open source']].forEach(function (pair) {
      var block = el('div');
      block.appendChild(el('dt', '', pair[1]));
      block.appendChild(el('dd', '', String(pair[0])));
      stat.appendChild(block);
    });
  }

  function renderPromo() {
    if (typeof PHASES === 'undefined' || !PHASES.length) return;
    var lessons = PHASES.reduce(function (total, phase) { return total + (phase.lessons ? phase.lessons.length : 0); }, 0);
    var lessonNode = document.getElementById('promoLessons');
    var phaseNode = document.getElementById('promoPhases');
    if (lessonNode && lessons) lessonNode.textContent = String(lessons);
    if (phaseNode) phaseNode.textContent = String(PHASES.length);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderStat();
    renderPromo();
    renderFilters();
    bindFilters();
    bindZoom();
    bindDetail();
    renderGrid();
    bindForm();
  });
})();
