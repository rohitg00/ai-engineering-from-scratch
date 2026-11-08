(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.boot(root);
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var DAY = 86400000;
  var COLORS = ['yellow', 'green', 'blue', 'pink'];
  var COLOR_LABELS = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' };
  var STATUS_OPTIONS = [
    ['', 'Any status'],
    ['anchored', 'Anchored'],
    ['moved', 'Re-anchored'],
    ['orphaned', 'Orphaned'],
    ['conflict', 'Conflict copy'],
    ['pending', 'Needs review']
  ];
  var KIND_OPTIONS = [['', 'Lessons and manuals'], ['lesson', 'Lessons'], ['manual', 'Manuals']];
  var DATE_OPTIONS = [['any', 'Any time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['custom', 'Custom range']];
  var MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  var IMPORT_ERRORS = {
    'not-json': 'That file is not valid JSON. Nothing was imported.',
    'wrong-format': 'That file is not a highlights sync file. Nothing was imported.',
    'newer-schema': 'That sync file needs a newer version of this site, or the highlights in this browser are read-only. Reload the page and try again. Nothing was imported.',
    'too-large': 'That file holds more highlights than this browser can store. Nothing was imported.'
  };

  function fold(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function displayText(value) {
    return String(value == null ? '' : value).replace(/\[(diagram|figure)(?:\s[^\]]*)?\]/g, '[$1]');
  }

  function terms(query) {
    var folded = fold(query);
    return folded ? folded.split(' ') : [];
  }

  function haystack(page, item) {
    var quote = item.quote || {};
    return fold([
      displayText(quote.exact),
      displayText(item.originalExact),
      item.note,
      page.title || page.path,
      item.sectionTitle
    ].join(' \u0001 '));
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function parseDay(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1) return null;
    return date.getTime();
  }

  function nextDay(ms) {
    var date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  }

  function dayStamp(ms) {
    var date = new Date(ms);
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    return date.getFullYear() + '-' + (month.length < 2 ? '0' : '') + month + '-' + (day.length < 2 ? '0' : '') + day;
  }

  function defaultCriteria() {
    return { query: '', colors: [], page: '', kind: '', status: '', date: 'any', from: '', to: '' };
  }

  function isFiltered(criteria) {
    var c = Object.assign(defaultCriteria(), criteria || {});
    return !!(fold(c.query) || c.colors.length || c.page || c.kind || c.status || c.date !== 'any' || c.from || c.to);
  }

  function dateRange(criteria, now) {
    var c = criteria || {};
    if (c.date === '7' || c.date === '30') return { from: now - Number(c.date) * DAY, to: Infinity };
    if (c.date !== 'custom') return { from: -Infinity, to: Infinity };
    var from = parseDay(c.from);
    var to = parseDay(c.to);
    if (from !== null && to !== null && to < from) {
      var swap = from;
      from = to;
      to = swap;
    }
    return { from: from === null ? -Infinity : from, to: to === null ? Infinity : nextDay(to) };
  }

  function statusTags(item) {
    var tags = [item.status || 'anchored'];
    if (item.review === 'conflict') tags.push('conflict');
    if (item.review === 'pending') tags.push('pending');
    return tags;
  }

  function badges(item) {
    var out = [];
    if (item.status === 'moved') {
      var label = 'Re-anchored';
      if (typeof item.confidence === 'number' && isFinite(item.confidence)) label += ' ' + Math.round(item.confidence * 100) + '%';
      if (item.review === 'pending') label += ' \u00b7 needs review';
      out.push({ tone: 'moved', label: label });
    } else if (item.status === 'orphaned') {
      out.push({ tone: 'orphaned', label: 'Orphaned' });
    }
    if (item.review === 'pending' && item.status !== 'moved') out.push({ tone: 'pending', label: 'Needs review' });
    if (item.review === 'conflict') out.push({ tone: 'conflict', label: 'Conflict copy' });
    return out;
  }

  function filterPages(pages, criteria, now) {
    var c = Object.assign(defaultCriteria(), criteria || {});
    var words = terms(c.query);
    var range = dateRange(c, typeof now === 'number' ? now : Date.now());
    var groups = [];
    var total = 0;
    var shown = 0;
    (pages || []).forEach(function (page) {
      var items = page.items || [];
      total += items.length;
      if (c.page && page.path !== c.page) return;
      if (c.kind && page.kind !== c.kind) return;
      var kept = items.filter(function (item) {
        if (c.colors.length && c.colors.indexOf(item.color) < 0) return false;
        if (c.status && statusTags(item).indexOf(c.status) < 0) return false;
        var created = Number(item.createdAt) || 0;
        if (created < range.from || created >= range.to) return false;
        if (!words.length) return true;
        var text = haystack(page, item);
        for (var i = 0; i < words.length; i++) {
          if (text.indexOf(words[i]) < 0) return false;
        }
        return true;
      });
      if (kept.length) {
        groups.push({ page: page, items: kept });
        shown += kept.length;
      }
    });
    return { groups: groups, total: total, shown: shown };
  }

  function keyOf(path, id) {
    return path + '\n' + id;
  }

  function selectionFrom(keys) {
    var selection = {};
    keys.forEach(function (key) {
      var cut = key.indexOf('\n');
      var path = key.slice(0, cut);
      if (!Object.prototype.hasOwnProperty.call(selection, path)) selection[path] = [];
      selection[path].push(key.slice(cut + 1));
    });
    return selection;
  }

  function shownKeys(result) {
    var keys = [];
    result.groups.forEach(function (group) {
      group.items.forEach(function (item) { keys.push(keyOf(group.page.path, item.id)); });
    });
    return keys;
  }

  function countLabel(result) {
    if (!result.total) return 'No highlights saved in this browser yet.';
    var pages = plural(result.groups.length, 'page');
    if (result.shown === result.total) return 'Showing all ' + plural(result.total, 'highlight') + ' from ' + pages + '.';
    if (!result.shown) return 'No highlights match these filters. ' + plural(result.total, 'highlight') + ' saved in all.';
    return 'Showing ' + result.shown + ' of ' + plural(result.total, 'highlight') + ' from ' + pages + '.';
  }

  function importSummary(result) {
    if (!result || !result.ok) return IMPORT_ERRORS[result && result.error] || 'The import did not finish. Nothing was imported.';
    var parts = [
      result.added + ' added',
      result.updated + ' updated',
      result.unchanged + ' unchanged',
      plural(result.conflicts, 'conflict'),
      result.skipped + ' skipped'
    ];
    var text = 'Import finished: ' + parts.join(', ') + '.';
    if (result.conflicts) {
      text += ' Notes that disagreed were kept as Conflict copy items. Choose Conflict copy in the Status filter to review them.';
    }
    return text;
  }

  function storageNotices(info) {
    var out = [];
    if (!info) return out;
    if (info.readOnly) {
      out.push('These highlights were saved by a newer version of this site. You can search and export them here, but deleting and importing are off until this page loads the newer version.');
    }
    if (info.lastError === 'quota') {
      out.push('Browser storage is full, so recent changes may not be saved. Download a sync file, then delete highlights you no longer need.');
    } else if (info.lastError === 'write-failed') {
      out.push('The browser refused to save the last change. Download a sync file to keep a copy.');
    } else if (!info.persistent && !info.readOnly) {
      out.push('This browser is not keeping highlights after the tab closes, for example in a private window or when site storage is blocked. Download a sync file to keep them.');
    }
    if (info.lastError === 'unreadable' || info.lastError === 'skipped-invalid') {
      out.push('Some saved highlights could not be read. The original data was kept as a backup in this browser.');
    }
    return out;
  }

  function formatDate(ms) {
    var date = new Date(ms);
    if (isNaN(date.getTime())) return '';
    try {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
      return dayStamp(ms);
    }
  }

  function preview(text, max) {
    var value = displayText(text).replace(/\s+/g, ' ').trim();
    return value.length > max ? value.slice(0, max - 1) + '\u2026' : value;
  }

  function readFileText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file);
    });
  }

  function browserDownload(win) {
    return function (name, text, type) {
      var blob = new win.Blob([text], { type: type });
      var url = win.URL.createObjectURL(blob);
      var link = win.document.createElement('a');
      link.href = url;
      link.download = name;
      link.hidden = true;
      win.document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 1000);
    };
  }

  function mount(container, store, env) {
    env = env || {};
    var doc = env.document || container.ownerDocument;
    var now = env.now || function () { return Date.now(); };
    var download = env.download;
    var readFile = env.readFile || readFileText;
    var criteria = defaultCriteria();
    var selected = {};
    var checkboxes = {};
    var lastResult = { groups: [], total: 0, shown: 0 };
    var uid = 0;

    function el(tag, attrs, text) {
      var node = doc.createElement(tag);
      if (attrs) {
        for (var name in attrs) {
          if (!Object.prototype.hasOwnProperty.call(attrs, name) || attrs[name] === null || attrs[name] === undefined) continue;
          if (name === 'className') node.className = attrs[name];
          else node.setAttribute(name, attrs[name]);
        }
      }
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }

    function add(parent) {
      for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) parent.appendChild(arguments[i]);
      }
      return parent;
    }

    function field(labelText, control, id) {
      control.setAttribute('id', id);
      return add(el('div', { className: 'hlp-field' }), el('label', { for: id }, labelText), control);
    }

    function selectOf(options) {
      var select = el('select');
      options.forEach(function (option) {
        var node = el('option', null, option[1]);
        node.value = option[0];
        select.appendChild(node);
      });
      return select;
    }

    container.textContent = '';

    var notices = el('div', { className: 'hlp-notices', id: 'hlpNotices' });
    var filters = el('form', { className: 'hlp-filters', role: 'search', 'aria-label': 'Filter highlights' });
    var search = el('input', { type: 'search', placeholder: 'Quote, note, page or section', autocomplete: 'off', spellcheck: 'false' });
    var colorSet = add(el('fieldset', { className: 'hlp-colors' }), el('legend', null, 'Colour'));
    var colorButtons = {};
    COLORS.forEach(function (color) {
      var button = el('button', { type: 'button', className: 'hlp-color hlp-color-' + color, 'aria-pressed': 'false', 'data-color': color });
      add(button, el('span', { className: 'hlp-swatch', 'aria-hidden': 'true' }), el('span', null, COLOR_LABELS[color]));
      colorButtons[color] = button;
      colorSet.appendChild(button);
    });
    var pageSelect = selectOf([['', 'All pages']]);
    pageSelect.setAttribute('data-i18n-skip', '');
    var kindSelect = selectOf(KIND_OPTIONS);
    var statusSelect = selectOf(STATUS_OPTIONS);
    var dateSelect = selectOf(DATE_OPTIONS);
    var fromInput = el('input', { type: 'date' });
    var toInput = el('input', { type: 'date' });
    var dates = add(el('fieldset', { className: 'hlp-dates' }), el('legend', null, 'Saved'),
      field('Period', dateSelect, 'hlpDate'), field('From', fromInput, 'hlpFrom'), field('To', toInput, 'hlpTo'));
    var clearButton = el('button', { type: 'button', className: 'btn btn-secondary hlp-clear', id: 'hlpClear' }, 'Clear filters');
    add(filters,
      add(el('div', { className: 'hlp-field hlp-search' }), el('label', { for: 'hlpSearch' }, 'Search highlights'), search),
      colorSet,
      add(el('div', { className: 'hlp-selects' }),
        field('Page', pageSelect, 'hlpPage'), field('Kind', kindSelect, 'hlpKind'), field('Status', statusSelect, 'hlpStatus')),
      dates,
      clearButton);
    search.setAttribute('id', 'hlpSearch');

    var count = el('p', { className: 'hlp-count', id: 'hlpCount', 'aria-live': 'polite', tabindex: '-1' });
    var toolbar = el('div', { className: 'hlp-toolbar', role: 'group', 'aria-label': 'Selected highlights' });
    var selectAll = el('input', { type: 'checkbox', id: 'hlpSelectAll' });
    var selectAllLabel = add(el('label', { className: 'hlp-select-all', for: 'hlpSelectAll' }), selectAll, el('span', null, 'Select all shown'));
    var selectedLabel = el('span', { className: 'hlp-selected', id: 'hlpSelected' });
    var exportMd = el('button', { type: 'button', className: 'btn btn-secondary', id: 'hlpExportMd', 'aria-describedby': 'hlpSelected' }, 'Export Markdown');
    var exportJson = el('button', { type: 'button', className: 'btn btn-secondary', id: 'hlpExportJson', 'aria-describedby': 'hlpSelected' }, 'Export JSON');
    var deleteButton = el('button', { type: 'button', className: 'btn btn-secondary hlp-danger', id: 'hlpDelete' }, 'Delete selected');
    add(toolbar, selectAllLabel, selectedLabel, add(el('div', { className: 'hlp-actions' }), exportMd, exportJson, deleteButton));

    var confirmText = el('p', { id: 'hlpConfirmText' });
    var confirmYes = el('button', { type: 'button', className: 'btn btn-primary hlp-danger-solid', id: 'hlpConfirmYes' }, 'Delete');
    var confirmNo = el('button', { type: 'button', className: 'btn btn-secondary', id: 'hlpConfirmNo' }, 'Cancel');
    var confirmBar = add(el('div', { className: 'hlp-confirm', id: 'hlpConfirm', role: 'group', 'aria-labelledby': 'hlpConfirmText', tabindex: '-1' }),
      confirmText, add(el('div', { className: 'hlp-actions' }), confirmYes, confirmNo));
    confirmBar.hidden = true;

    var message = el('p', { className: 'hlp-message', id: 'hlpMessage', role: 'status' });
    var results = el('div', { className: 'hlp-results', id: 'hlpResults', 'data-i18n-skip': '' });

    var syncDownload = el('button', { type: 'button', className: 'btn btn-secondary', id: 'hlpSyncDownload' }, 'Download sync file');
    var syncImport = el('button', { type: 'button', className: 'btn btn-secondary', id: 'hlpSyncImport', 'aria-describedby': 'hlpSyncHelp' }, 'Import sync file');
    var syncInput = el('input', { type: 'file', accept: 'application/json,.json', id: 'hlpSyncFile', tabindex: '-1', 'aria-hidden': 'true' });
    syncInput.hidden = true;
    var syncResult = el('p', { className: 'hlp-message', id: 'hlpSyncResult', role: 'status' });
    var sync = add(el('section', { className: 'hlp-sync', 'aria-labelledby': 'hlpSyncTitle' }),
      el('h2', { id: 'hlpSyncTitle' }, 'Sync file'),
      el('p', null, 'A sync file is a copy of every highlight in this browser. Download it here, then import it on this page in another browser or on another device. Importing merges the file with what is already saved, so nothing is replaced blindly.'),
      el('p', { id: 'hlpSyncHelp' }, 'When the same highlight has different notes in the file and in this browser, the newer note wins and the other note is kept as a separate item marked Conflict copy. Review those items and delete the copy you do not need.'),
      add(el('div', { className: 'hlp-actions' }), syncDownload, syncImport, syncInput),
      syncResult);

    add(container, notices, filters, count, toolbar, confirmBar, message, results, sync);

    function info() {
      try {
        return store.info() || {};
      } catch (_) {
        return {};
      }
    }

    function readOnly() {
      return !!info().readOnly;
    }

    function selectedKeys() {
      return Object.keys(selected);
    }

    function renderNotices() {
      notices.textContent = '';
      storageNotices(info()).forEach(function (text) {
        notices.appendChild(el('p', { className: 'hlp-notice' }, text));
      });
    }

    function syncPageOptions(pages) {
      var current = criteria.page;
      pageSelect.textContent = '';
      var all = el('option', null, 'All pages');
      all.value = '';
      pageSelect.appendChild(all);
      var found = false;
      pages.forEach(function (page) {
        var option = el('option', null, (page.title || page.path) + ' (' + page.items.length + ')');
        option.value = page.path;
        if (page.path === current) found = true;
        pageSelect.appendChild(option);
      });
      if (!found) criteria.page = '';
      pageSelect.value = criteria.page;
    }

    function updateToolbar() {
      var n = selectedKeys().length;
      var shown = lastResult.shown;
      selectAll.checked = shown > 0 && n === shown;
      selectAll.indeterminate = n > 0 && n < shown;
      selectAll.disabled = shown === 0;
      exportMd.disabled = shown === 0;
      exportJson.disabled = shown === 0;
      deleteButton.disabled = n === 0 || readOnly();
      syncImport.disabled = readOnly();
      selectedLabel.textContent = n
        ? plural(n, 'highlight') + ' selected.'
        : 'None selected. Exports include all ' + plural(shown, 'highlight') + ' shown.';
      if (!confirmBar.hidden) {
        if (!n) closeConfirm(false);
        else confirmText.textContent = confirmMessage(n);
      }
    }

    function renderItem(page, item) {
      var key = keyOf(page.path, item.id);
      uid += 1;
      var box = el('input', { type: 'checkbox', id: 'hlpItem' + uid, 'aria-label': 'Select highlight: ' + preview(item.quote.exact, 80) });
      box.checked = !!selected[key];
      box.addEventListener('change', function () {
        if (box.checked) selected[key] = true;
        else delete selected[key];
        updateToolbar();
      });
      checkboxes[key] = box;
      var body = el('div', { className: 'hlp-item-body' });
      body.appendChild(el('blockquote', { className: 'hlp-quote' }, displayText(item.quote.exact)));
      if (item.originalExact && item.originalExact !== item.quote.exact) {
        body.appendChild(add(el('p', { className: 'hlp-original' }), el('span', { className: 'hlp-label' }, 'Originally: '), el('span', null, displayText(item.originalExact))));
      }
      if (item.note) {
        body.appendChild(add(el('p', { className: 'hlp-note' }), el('span', { className: 'hlp-label' }, 'Note: '), el('span', null, item.note)));
      }
      var meta = el('p', { className: 'hlp-meta' });
      add(meta, add(el('span', { className: 'hlp-color-name' }), el('span', { className: 'hlp-swatch', 'aria-hidden': 'true' }), el('span', null, COLOR_LABELS[item.color] || item.color)));
      if (item.sectionTitle) meta.appendChild(el('span', { className: 'hlp-section' }, item.sectionTitle));
      if (item.createdAt && Number.isFinite(new Date(item.createdAt).getTime())) {
        var time = el('time', { datetime: new Date(item.createdAt).toISOString() }, formatDate(item.createdAt));
        meta.appendChild(add(el('span'), el('span', { className: 'hlp-label' }, 'Saved '), time));
      }
      if (item.lang && item.lang !== 'en') meta.appendChild(el('span', { lang: item.lang }, item.lang.toUpperCase()));
      badges(item).forEach(function (badge) {
        meta.appendChild(el('span', { className: 'hlp-badge hlp-badge-' + badge.tone }, badge.label));
      });
      body.appendChild(meta);
      var open = el('a', { className: 'hlp-open', href: store.itemUrl ? store.itemUrl(page.path, item) : page.url + '#hl-' + item.id, 'aria-label': 'Open this highlight in ' + (page.title || page.path) }, 'Open');
      return add(el('li', { className: 'hlp-item hlp-item-' + item.color, 'data-key': key }),
        add(el('div', { className: 'hlp-item-select' }), box), body, open);
    }

    function renderEmpty(total) {
      if (!total) {
        return add(el('div', { className: 'hlp-empty' }),
          el('h2', null, 'No highlights yet'),
          el('p', null, 'Select text in any lesson or manual and choose a colour to save a highlight. It shows up here, and you can add a note to it.'),
          add(el('p'), el('a', { href: 'catalog.html' }, 'Browse the lessons'), doc.createTextNode(' or '), el('a', { href: 'manuals.html' }, 'open a manual'), doc.createTextNode('.')));
      }
      var reset = el('button', { type: 'button', className: 'btn btn-secondary' }, 'Clear filters');
      reset.addEventListener('click', function () { clearFilters(true); });
      return add(el('div', { className: 'hlp-empty' }), el('p', null, 'No highlights match these filters.'), reset);
    }

    function render() {
      var pages = [];
      try {
        pages = store.pages() || [];
      } catch (_) {
        pages = [];
      }
      syncPageOptions(pages);
      lastResult = filterPages(pages, criteria, now());
      var visible = {};
      shownKeys(lastResult).forEach(function (key) { visible[key] = true; });
      Object.keys(selected).forEach(function (key) { if (!visible[key]) delete selected[key]; });
      checkboxes = {};
      results.textContent = '';
      if (!lastResult.shown) {
        results.appendChild(renderEmpty(lastResult.total));
      } else {
        lastResult.groups.forEach(function (group) {
          uid += 1;
          var page = group.page;
          var headingId = 'hlpGroup' + uid;
          var head = add(el('div', { className: 'hlp-group-head' }),
            add(el('h2', { className: 'hlp-group-title', id: headingId }), el('a', { href: page.url }, page.title || page.path)),
            el('p', { className: 'hlp-group-meta' }, (page.kind === 'manual' ? 'Manual' : 'Lesson') + ' \u00b7 ' + plural(group.items.length, 'highlight')));
          var list = el('ol', { className: 'hlp-list' });
          group.items.forEach(function (item) { list.appendChild(renderItem(page, item)); });
          results.appendChild(add(el('section', { className: 'hlp-group', 'aria-labelledby': headingId }), head, list));
        });
      }
      var hasAny = lastResult.total > 0;
      filters.hidden = !hasAny;
      toolbar.hidden = !hasAny;
      count.textContent = countLabel(lastResult);
      clearButton.disabled = !isFiltered(criteria);
      renderNotices();
      updateToolbar();
    }

    function readControls() {
      criteria.query = search.value;
      criteria.page = pageSelect.value;
      criteria.kind = kindSelect.value;
      criteria.status = statusSelect.value;
      criteria.date = dateSelect.value;
      criteria.from = fromInput.value;
      criteria.to = toInput.value;
    }

    function writeControls() {
      search.value = criteria.query;
      pageSelect.value = criteria.page;
      kindSelect.value = criteria.kind;
      statusSelect.value = criteria.status;
      dateSelect.value = criteria.date;
      fromInput.value = criteria.from;
      toInput.value = criteria.to;
      COLORS.forEach(function (color) {
        colorButtons[color].setAttribute('aria-pressed', criteria.colors.indexOf(color) >= 0 ? 'true' : 'false');
      });
    }

    function clearFilters(focusSearch) {
      criteria = defaultCriteria();
      writeControls();
      render();
      if (focusSearch) search.focus();
    }

    function onFilter() {
      readControls();
      render();
    }

    function confirmMessage(n) {
      return 'Delete ' + plural(n, 'highlight') + '? This cannot be undone. Download a sync file first if you may want them back.';
    }

    function openConfirm() {
      var n = selectedKeys().length;
      if (!n || readOnly()) return;
      confirmText.textContent = confirmMessage(n);
      confirmBar.hidden = false;
      confirmBar.focus();
    }

    function closeConfirm(restoreFocus) {
      confirmBar.hidden = true;
      if (restoreFocus) deleteButton.focus();
    }

    function selectionOrShown() {
      var keys = selectedKeys();
      return { selection: selectionFrom(keys.length ? keys : shownKeys(lastResult)), count: keys.length || lastResult.shown };
    }

    function exportAs(kind) {
      var picked = selectionOrShown();
      if (!picked.count) return;
      var stamp = dayStamp(now());
      if (kind === 'md') {
        var options = env.origin ? { origin: env.origin } : undefined;
        download('highlights-' + stamp + '.md', store.exportMarkdown(picked.selection, options), 'text/markdown;charset=utf-8');
        message.textContent = 'Exported ' + plural(picked.count, 'highlight') + ' as Markdown.';
      } else {
        download('highlights-' + stamp + '.json', store.exportJson(picked.selection), 'application/json;charset=utf-8');
        message.textContent = 'Exported ' + plural(picked.count, 'highlight') + ' as JSON.';
      }
    }

    search.addEventListener('input', onFilter);
    filters.addEventListener('submit', function (event) { event.preventDefault(); onFilter(); });
    [pageSelect, kindSelect, statusSelect].forEach(function (control) { control.addEventListener('change', onFilter); });
    dateSelect.addEventListener('change', function () {
      if (dateSelect.value !== 'custom') {
        fromInput.value = '';
        toInput.value = '';
      }
      onFilter();
    });
    [fromInput, toInput].forEach(function (control) {
      control.addEventListener('change', function () {
        if (fromInput.value || toInput.value) dateSelect.value = 'custom';
        onFilter();
      });
    });
    COLORS.forEach(function (color) {
      colorButtons[color].addEventListener('click', function () {
        var index = criteria.colors.indexOf(color);
        if (index >= 0) criteria.colors.splice(index, 1);
        else criteria.colors.push(color);
        colorButtons[color].setAttribute('aria-pressed', index >= 0 ? 'false' : 'true');
        render();
      });
    });
    clearButton.addEventListener('click', function () { clearFilters(true); });
    selectAll.addEventListener('change', function () {
      var keys = shownKeys(lastResult);
      var on = selectAll.checked;
      keys.forEach(function (key) {
        if (on) selected[key] = true;
        else delete selected[key];
        if (checkboxes[key]) checkboxes[key].checked = on;
      });
      updateToolbar();
    });
    exportMd.addEventListener('click', function () { exportAs('md'); });
    exportJson.addEventListener('click', function () { exportAs('json'); });
    deleteButton.addEventListener('click', openConfirm);
    confirmNo.addEventListener('click', function () { closeConfirm(true); });
    confirmBar.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeConfirm(true);
    });
    confirmYes.addEventListener('click', function () {
      var selection = selectionFrom(selectedKeys());
      closeConfirm(false);
      var removed = store.removeMany(selection) || 0;
      selected = {};
      render();
      message.textContent = removed
        ? 'Deleted ' + plural(removed, 'highlight') + '.'
        : 'Nothing was deleted. The highlights in this browser may be read-only.';
      count.focus();
    });
    syncDownload.addEventListener('click', function () {
      download('highlights-sync-' + dayStamp(now()) + '.json', store.exportJson(null), 'application/json;charset=utf-8');
      syncResult.textContent = 'Downloaded a sync file with ' + plural(lastResult.total, 'highlight') + '.';
    });
    syncImport.addEventListener('click', function () {
      syncInput.value = '';
      syncInput.click();
    });
    syncInput.addEventListener('change', function () {
      var file = syncInput.files && syncInput.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        syncResult.textContent = IMPORT_ERRORS['too-large'];
        return;
      }
      syncResult.textContent = 'Importing ' + (file.name || 'file') + '\u2026';
      return Promise.resolve(readFile(file)).then(function (text) {
        var result = store.importJson(String(text));
        render();
        syncResult.textContent = importSummary(result);
      }, function () {
        syncResult.textContent = 'That file could not be read. Nothing was imported.';
      });
    });

    if (typeof store.onChange === 'function') store.onChange(function () { render(); });
    if (env && env.window && typeof env.window.addEventListener === 'function' && typeof store.reload === 'function') {
      env.window.addEventListener('pageshow', function (event) { if (event && event.persisted) store.reload(); });
    }
    writeControls();
    render();

    return {
      render: render,
      criteria: function () { return Object.assign({}, criteria, { colors: criteria.colors.slice() }); },
      selected: selectedKeys
    };
  }

  function boot(win) {
    function start() {
      var container = win.document.getElementById('highlightsApp');
      if (!container) return;
      if (!win.AIFSHighlightStore) {
        container.textContent = '';
        var failed = win.document.createElement('p');
        failed.className = 'hlp-notice';
        failed.textContent = 'The highlights store could not load in this browser, so saved highlights cannot be shown.';
        container.appendChild(failed);
        return;
      }
      var protocol = win.location && win.location.protocol;
      mount(container, win.AIFSHighlightStore, {
        document: win.document,
        window: win,
        download: browserDownload(win),
        origin: protocol === 'https:' || protocol === 'http:' ? win.location.origin : ''
      });
    }
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return {
    COLORS: COLORS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    fold: fold,
    displayText: displayText,
    terms: terms,
    parseDay: parseDay,
    dayStamp: dayStamp,
    dateRange: dateRange,
    defaultCriteria: defaultCriteria,
    isFiltered: isFiltered,
    statusTags: statusTags,
    badges: badges,
    filterPages: filterPages,
    keyOf: keyOf,
    selectionFrom: selectionFrom,
    shownKeys: shownKeys,
    countLabel: countLabel,
    importSummary: importSummary,
    storageNotices: storageNotices,
    mount: mount,
    boot: boot
  };
}));
