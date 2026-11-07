(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AIFSHighlightStore = api.create(root);
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STORAGE_KEY = 'aifs:highlights:v2';
  var LEGACY_KEY = 'aifs:highlights:v1';
  var BACKUP_KEY = 'aifs:highlights:v2:unreadable';
  var SCHEMA_VERSION = 2;
  var EXPORT_FORMAT = 'aifs-highlights';
  var SHARE_FORMAT = 1;
  var COLORS = ['yellow', 'green', 'blue', 'pink'];
  var STATUSES = ['anchored', 'moved', 'orphaned'];
  var REVIEWS = ['', 'pending', 'confirmed', 'rejected', 'conflict'];
  var KINDS = ['lesson', 'manual'];
  var MAX_ITEMS_PER_PAGE = 500;
  var MAX_EXACT = 20000;
  var MAX_CONTEXT = 64;
  var MAX_NOTE = 2000;
  var MAX_TITLE = 200;
  var MAX_BYTES = 1500000;
  var MAX_SHARE_ITEMS = 100;
  var MAX_SHARE_LENGTH = 200000;
  var PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,299}$/;
  var ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
  var LANG_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function timestamp(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 8640000000000000 ? Math.floor(n) : 0;
  }

  function text(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : '';
  }

  function offset(value) {
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  function ratio(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
  }

  function newId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hashText(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function kindOf(path) {
    return /^manuals\//.test(path) ? 'manual' : 'lesson';
  }

  function urlFor(path) {
    if (kindOf(path) === 'manual') return 'manual-' + path.slice('manuals/'.length) + '.html';
    return 'lesson.html?path=' + encodeURIComponent(path);
  }

  function itemUrl(path, item) {
    var url = urlFor(path);
    if (kindOf(path) === 'lesson' && item && item.lang) url += '&lang=' + encodeURIComponent(item.lang);
    return url + (item && item.id ? '#hl-' + item.id : '');
  }

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, pages: {}, updatedAt: 0 };
  }

  function normalizeLang(value) {
    var lang = typeof value === 'string' ? value.toLowerCase() : '';
    return LANG_PATTERN.test(lang) ? lang : 'en';
  }

  function normalizeOriginal(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.exact !== 'string' || !raw.exact.trim()) return null;
    var position = raw.position && typeof raw.position === 'object' ? raw.position : {};
    var start = offset(position.start);
    return {
      exact: text(raw.exact, MAX_EXACT),
      prefix: text(raw.prefix, MAX_CONTEXT),
      suffix: text(raw.suffix, MAX_CONTEXT),
      position: { start: start, end: Math.max(start, offset(position.end)), length: offset(position.length) }
    };
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var quote = raw.quote && typeof raw.quote === 'object' ? raw.quote : {};
    var exact = text(quote.exact, MAX_EXACT);
    if (!exact.trim()) return null;
    var id = typeof raw.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : newId();
    var position = raw.position && typeof raw.position === 'object' ? raw.position : {};
    var start = offset(position.start);
    var end = Math.max(start, offset(position.end));
    var createdAt = timestamp(raw.createdAt) || Date.now();
    var confidence = raw.confidence === null || raw.confidence === undefined ? null : ratio(raw.confidence);
    return {
      id: id,
      lang: normalizeLang(raw.lang),
      color: COLORS.indexOf(raw.color) >= 0 ? raw.color : COLORS[0],
      note: text(raw.note, MAX_NOTE),
      quote: {
        exact: exact,
        prefix: text(quote.prefix, MAX_CONTEXT),
        suffix: text(quote.suffix, MAX_CONTEXT)
      },
      originalExact: text(raw.originalExact, MAX_EXACT),
      originalQuote: normalizeOriginal(raw.originalQuote),
      position: { start: start, end: end, length: offset(position.length) },
      section: text(raw.section, 200),
      sectionTitle: text(raw.sectionTitle, MAX_TITLE),
      sectionIndex: Number.isInteger(raw.sectionIndex) && raw.sectionIndex >= 0 ? raw.sectionIndex : -1,
      sectionOffset: ratio(raw.sectionOffset),
      sectionSpan: ratio(raw.sectionSpan),
      status: STATUSES.indexOf(raw.status) >= 0 ? raw.status : 'anchored',
      review: REVIEWS.indexOf(raw.review) >= 0 ? raw.review : '',
      confidence: confidence,
      orphanHash: text(raw.orphanHash, 40),
      conflictOf: typeof raw.conflictOf === 'string' && ID_PATTERN.test(raw.conflictOf) ? raw.conflictOf : '',
      createdAt: createdAt,
      updatedAt: timestamp(raw.updatedAt) || createdAt
    };
  }

  function normalizePage(path, raw) {
    var page = { kind: kindOf(path), title: '', url: urlFor(path), items: [] };
    if (!raw || typeof raw !== 'object') return { page: page, skipped: 0 };
    page.title = text(raw.title, MAX_TITLE);
    if (KINDS.indexOf(raw.kind) >= 0 && raw.kind === kindOf(path)) page.kind = raw.kind;
    var items = Array.isArray(raw.items) ? raw.items : [];
    var seen = Object.create(null);
    var skipped = 0;
    for (var i = 0; i < items.length; i++) {
      var item = normalizeItem(items[i]);
      if (!item || seen[item.id] || page.items.length >= MAX_ITEMS_PER_PAGE) {
        skipped++;
        continue;
      }
      seen[item.id] = true;
      page.items.push(item);
    }
    sortItems(page.items);
    return { page: page, skipped: skipped };
  }

  function sortItems(items) {
    items.sort(function (a, b) { return a.position.start - b.position.start || a.createdAt - b.createdAt; });
  }

  function normalizeState(raw) {
    var state = emptyState();
    var skipped = 0;
    if (!raw || typeof raw !== 'object' || !raw.pages || typeof raw.pages !== 'object' || Array.isArray(raw.pages)) {
      return { state: state, skipped: 0, valid: false };
    }
    for (var path in raw.pages) {
      if (!own(raw.pages, path)) continue;
      if (!PATH_PATTERN.test(path)) {
        skipped++;
        continue;
      }
      var result = normalizePage(path, raw.pages[path]);
      skipped += result.skipped;
      if (result.page.items.length) state.pages[path] = result.page;
    }
    state.updatedAt = timestamp(raw.updatedAt);
    return { state: state, skipped: skipped, valid: true };
  }

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    var version = Number(raw.schemaVersion) || 1;
    if (version >= SCHEMA_VERSION) return raw;
    var pages = {};
    var source = raw.pages && typeof raw.pages === 'object' ? raw.pages : {};
    for (var path in source) {
      if (!own(source, path) || !source[path] || typeof source[path] !== 'object') continue;
      var items = Array.isArray(source[path].items) ? source[path].items : [];
      pages[path] = {
        kind: kindOf(path),
        title: source[path].title,
        url: urlFor(path),
        items: items.map(function (item) {
          if (!item || typeof item !== 'object') return item;
          var next = Object.assign({}, item);
          if (next.status === 'moved' && !next.review) next.review = 'pending';
          return next;
        })
      };
    }
    return { schemaVersion: SCHEMA_VERSION, pages: pages, updatedAt: raw.updatedAt };
  }

  function shareKey(quote, note) {
    return [quote.exact, quote.prefix, quote.suffix, note].join('\u0000');
  }

  function contentKey(item) {
    return [item.color, item.note, item.quote.exact, item.quote.prefix, item.quote.suffix, item.position.start].join('\u0000');
  }

  function selectionPaths(state, selection) {
    if (!selection) return Object.keys(state.pages).sort();
    if (Array.isArray(selection)) return selection.slice();
    return Object.keys(selection);
  }

  function selectedItems(state, selection, path) {
    var page = state.pages[path];
    if (!page) return [];
    if (!selection || Array.isArray(selection)) return page.items.slice();
    var ids = selection[path] || [];
    return page.items.filter(function (item) { return ids.indexOf(item.id) >= 0; });
  }

  function exportPayload(state, selection) {
    var pages = {};
    var paths = selectionPaths(state, selection);
    for (var i = 0; i < paths.length; i++) {
      if (!own(state.pages, paths[i])) continue;
      var items = selectedItems(state, selection, paths[i]);
      if (!items.length) continue;
      var page = state.pages[paths[i]];
      pages[paths[i]] = { kind: page.kind, title: page.title, url: page.url, items: items };
    }
    return {
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      pages: pages
    };
  }

  function markdownLine(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
      .replace(/[\\`*_[\]()#+!|~-]/g, '\\$&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function toMarkdown(state, selection, options) {
    options = options || {};
    var origin = options.origin || 'https://aiengineeringfromscratch.com';
    var paths = selectionPaths(state, selection).sort();
    var out = ['# Highlights', ''];
    var count = 0;
    for (var i = 0; i < paths.length; i++) {
      var page = state.pages[paths[i]];
      var items = page ? selectedItems(state, selection, paths[i]) : [];
      if (!items.length) continue;
      out.push('## ' + markdownLine(page.title || paths[i]), '');
      out.push('Source: ' + origin + '/' + page.url, '');
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        count++;
        out.push('> ' + markdownLine(item.quote.exact), '');
        if (item.originalExact && item.originalExact !== item.quote.exact) {
          out.push('Originally highlighted: ' + markdownLine(item.originalExact), '');
        }
        var meta = ['Colour: ' + item.color];
        if (item.sectionTitle) meta.push('Section: ' + markdownLine(item.sectionTitle));
        if (item.lang !== 'en') meta.push('Language: ' + item.lang);
        if (item.status === 'orphaned') meta.push('Status: orphaned (the text changed)');
        if (item.status === 'moved') meta.push('Status: re-anchored' + (item.confidence !== null ? ' (' + Math.round(item.confidence * 100) + '% match)' : ''));
        if (item.review === 'conflict') meta.push('Status: conflict copy from an import');
        out.push(meta.join(' \u00b7 '), '');
        if (item.note) out.push('Note: ' + markdownLine(item.note), '');
      }
    }
    if (!count) out.push('No highlights yet.', '');
    return out.join('\n');
  }

  function toBase64Url(value) {
    var bytes = new TextEncoder().encode(value);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, i, i + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(value) {
    var padded = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    var binary = atob(padded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function sharePayload(state, path, ids) {
    var page = state.pages[path];
    if (!page) return null;
    var items = page.items.filter(function (item) { return !ids || ids.indexOf(item.id) >= 0; }).slice(0, MAX_SHARE_ITEMS);
    if (!items.length) return null;
    return {
      v: SHARE_FORMAT,
      k: path,
      t: page.title,
      i: items.map(function (item) {
        return {
          q: item.quote.exact,
          p: item.quote.prefix,
          s: item.quote.suffix,
          o: item.position.start,
          l: item.position.length,
          c: item.color,
          n: item.note,
          h: item.section,
          g: item.lang
        };
      })
    };
  }

  function encodeShare(payload) {
    return toBase64Url(JSON.stringify(payload));
  }

  function decodeShare(value) {
    var parsed = null;
    try {
      if (!value || String(value).length > MAX_SHARE_LENGTH) return null;
      parsed = JSON.parse(fromBase64Url(value));
    } catch (_) {
      return null;
    }
    if (!parsed || parsed.v !== SHARE_FORMAT || typeof parsed.k !== 'string' || !PATH_PATTERN.test(parsed.k) || !Array.isArray(parsed.i)) return null;
    var items = [];
    for (var i = 0; i < parsed.i.length && items.length < MAX_SHARE_ITEMS; i++) {
      var raw = parsed.i[i] || {};
      var item = normalizeItem({
        id: 's' + i,
        lang: raw.g,
        color: raw.c,
        note: raw.n,
        quote: { exact: raw.q, prefix: raw.p, suffix: raw.s },
        position: { start: raw.o, end: offset(raw.o) + text(raw.q, MAX_EXACT).length, length: raw.l },
        section: raw.h,
        createdAt: 1,
        updatedAt: 1
      });
      if (item) items.push(item);
    }
    if (!items.length) return null;
    return { path: parsed.k, title: text(parsed.t, MAX_TITLE), items: items };
  }

  function create(win) {
    var storage = null;
    try {
      storage = win && win.localStorage ? win.localStorage : null;
    } catch (_) {
      storage = null;
    }
    var memory = null;
    var dirty = false;
    var unsavedRemovals = Object.create(null);
    var persistent = !!storage;
    var readOnly = false;
    var lastError = '';
    var loadError = '';
    var storedRaw = '';
    var listeners = [];

    function readKey(key) {
      if (!storage) return null;
      try {
        return storage.getItem(key);
      } catch (_) {
        persistent = false;
        storage = null;
        return null;
      }
    }

    function backupUnreadable(raw) {
      if (!storage) return;
      try {
        var existing = storage.getItem(BACKUP_KEY);
        if (!existing) storage.setItem(BACKUP_KEY, raw);
        else if (existing !== raw) {
          var key = BACKUP_KEY + ':' + hashText(raw);
          if (!storage.getItem(key)) storage.setItem(key, raw);
        }
      } catch (_) {}
    }

    function parse(raw) {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    function fromStorage() {
      var raw = readKey(STORAGE_KEY);
      var migrated = false;
      storedRaw = raw || '';
      if (!raw) {
        var legacy = readKey(LEGACY_KEY);
        storedRaw = legacy || '';
        if (!legacy) return emptyState();
        raw = legacy;
        migrated = true;
      }
      var parsed = parse(raw);
      if (parsed && typeof parsed === 'object' && Number(parsed.schemaVersion) > SCHEMA_VERSION) {
        readOnly = true;
        loadError = 'newer-schema';
        return normalizeState(parsed).state;
      }
      readOnly = false;
      var result = normalizeState(migrate(parsed));
      if (!result.valid || result.skipped) {
        backupUnreadable(raw);
        loadError = result.valid ? 'skipped-invalid' : 'unreadable';
      }
      if (migrated && result.valid && storage) {
        try {
          result.state.schemaVersion = SCHEMA_VERSION;
          storage.setItem(STORAGE_KEY, JSON.stringify(result.state));
        } catch (_) {}
      }
      return result.state;
    }

    function load() {
      if (!memory) memory = fromStorage();
      return memory;
    }

    function storedState() {
      var parsed = storedRaw ? parse(storedRaw) : null;
      return parsed ? normalizeState(migrate(parsed)).state : emptyState();
    }

    function mergeStored() {
      var unsaved = dirty && memory ? memory : null;
      var previous = unsaved ? storedState() : null;
      memory = null;
      readOnly = false;
      load();
      if (unsaved && !readOnly) memory = keepUnsaved(memory, unsaved, previous);
    }

    function fresh() {
      if (storage) mergeStored();
      return load();
    }

    function notify(meta) {
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](memory, meta || {}); } catch (_) {}
      }
    }

    function size(value) {
      try {
        return JSON.stringify(value).length;
      } catch (_) {
        return Infinity;
      }
    }

    function save(state, meta) {
      if (readOnly) {
        lastError = 'newer-schema';
        return false;
      }
      state.schemaVersion = SCHEMA_VERSION;
      state.updatedAt = Date.now();
      memory = state;
      if (storage) {
        try {
          var serialized = JSON.stringify(state);
          storage.setItem(STORAGE_KEY, serialized);
          storedRaw = serialized;
          persistent = true;
          dirty = false;
          unsavedRemovals = Object.create(null);
          lastError = '';
        } catch (error) {
          persistent = false;
          dirty = true;
          lastError = error && /quota/i.test(String(error.name || error.message)) ? 'quota' : 'write-failed';
        }
      }
      notify(meta);
      return true;
    }

    function page(path) {
      var state = load();
      return own(state.pages, path) ? state.pages[path] : null;
    }

    function items(path) {
      var current = page(path);
      return current ? current.items.slice() : [];
    }

    function writable() {
      var state = fresh();
      if (readOnly) {
        lastError = 'newer-schema';
        return null;
      }
      return state;
    }

    function ensurePage(state, path, meta) {
      if (!own(state.pages, path)) state.pages[path] = { kind: kindOf(path), title: '', url: urlFor(path), items: [] };
      var target = state.pages[path];
      if (meta && meta.title) target.title = text(meta.title, MAX_TITLE);
      return target;
    }

    function add(path, raw, meta) {
      lastError = '';
      if (!PATH_PATTERN.test(String(path || ''))) return null;
      var item = normalizeItem(Object.assign({}, raw, { id: newId(), createdAt: Date.now(), updatedAt: Date.now() }));
      if (!item) return null;
      var state = writable();
      if (!state) return null;
      var existing = own(state.pages, path) ? state.pages[path] : null;
      if (existing && existing.items.length >= MAX_ITEMS_PER_PAGE) {
        lastError = 'page-full';
        return null;
      }
      if (size(state) + size(item) > MAX_BYTES) {
        lastError = 'full';
        return null;
      }
      var target = ensurePage(state, path, meta);
      target.items.push(item);
      sortItems(target.items);
      return save(state) ? item : null;
    }

    function overBudget(state, previous, next) {
      return size(next) > size(previous) && size(state) - size(previous) + size(next) > MAX_BYTES;
    }

    function update(path, id, patch) {
      lastError = '';
      var state = writable();
      if (!state || !own(state.pages, path)) return null;
      var current = state.pages[path];
      for (var i = 0; i < current.items.length; i++) {
        if (current.items[i].id !== id) continue;
        var merged = normalizeItem(Object.assign({}, current.items[i], patch, { id: id, updatedAt: Date.now() }));
        if (!merged) return null;
        merged.createdAt = current.items[i].createdAt;
        if (overBudget(state, current.items[i], merged)) {
          lastError = 'full';
          return null;
        }
        current.items[i] = merged;
        sortItems(current.items);
        return save(state) ? merged : null;
      }
      return null;
    }

    function updateMany(path, patches, silentTimestamp) {
      var state = writable();
      if (!state || !own(state.pages, path)) return false;
      var current = state.pages[path];
      var changed = false;
      for (var i = 0; i < current.items.length; i++) {
        var patch = patches[current.items[i].id];
        if (!patch) continue;
        var merged = normalizeItem(Object.assign({}, current.items[i], patch));
        if (!merged) continue;
        if (!silentTimestamp) merged.updatedAt = Date.now();
        if (overBudget(state, current.items[i], merged)) {
          lastError = 'full';
          continue;
        }
        current.items[i] = merged;
        changed = true;
      }
      if (!changed) return false;
      sortItems(current.items);
      return save(state);
    }

    function removeMany(selection) {
      lastError = '';
      var state = writable();
      if (!state) return 0;
      var removed = 0;
      for (var path in selection) {
        if (!own(selection, path) || !own(state.pages, path)) continue;
        var ids = selection[path] || [];
        if (!own(unsavedRemovals, path)) unsavedRemovals[path] = Object.create(null);
        ids.forEach(function (id) { unsavedRemovals[path][id] = true; });
        var before = state.pages[path].items.length;
        state.pages[path].items = state.pages[path].items.filter(function (item) { return ids.indexOf(item.id) < 0; });
        removed += before - state.pages[path].items.length;
        if (!state.pages[path].items.length) delete state.pages[path];
      }
      if (removed) save(state);
      return removed;
    }

    function remove(path, id) {
      var selection = {};
      selection[path] = [id];
      return removeMany(selection) === 1;
    }

    function pages() {
      var state = load();
      return Object.keys(state.pages).sort().map(function (path) {
        var current = state.pages[path];
        return { path: path, kind: current.kind, title: current.title, url: current.url, items: current.items.slice() };
      });
    }

    function exportJson(selection) {
      return JSON.stringify(exportPayload(load(), selection), null, 2);
    }

    function exportMarkdown(selection, options) {
      return toMarkdown(load(), selection, options);
    }

    function conflictCopy(loser, winner) {
      var copy = Object.assign({}, loser);
      copy.id = (winner.id + '-c' + hashText(contentKey(loser))).slice(0, 64);
      copy.review = 'conflict';
      copy.conflictOf = winner.id;
      return copy;
    }

    function mergeItem(target, item, result) {
      var index = -1;
      for (var j = 0; j < target.items.length; j++) {
        if (target.items[j].id === item.id) { index = j; break; }
      }
      if (index < 0) {
        if (target.items.length >= MAX_ITEMS_PER_PAGE) { result.skipped++; return; }
        target.items.push(item);
        result.added++;
        return;
      }
      var local = target.items[index];
      if (contentKey(local) === contentKey(item)) {
        result.unchanged++;
        return;
      }
      var incomingWins = item.updatedAt > local.updatedAt;
      var winner = incomingWins ? item : local;
      var loser = incomingWins ? local : item;
      var noteConflict = loser.note && winner.note !== loser.note && winner.note.indexOf(loser.note) < 0;
      if (incomingWins) {
        target.items[index] = item;
        result.updated++;
      } else {
        result.unchanged++;
      }
      if (noteConflict) {
        var copy = conflictCopy(loser, winner);
        for (var k = 0; k < target.items.length; k++) {
          if (target.items[k].id === copy.id) return;
        }
        if (target.items.length >= MAX_ITEMS_PER_PAGE) {
          result.skipped++;
          return;
        }
        target.items.push(copy);
        result.conflicts++;
      }
    }

    function importJson(source) {
      lastError = '';
      var empty = { ok: false, error: '', added: 0, updated: 0, unchanged: 0, conflicts: 0, skipped: 0 };
      var parsed = null;
      try {
        parsed = typeof source === 'string' ? JSON.parse(source) : source;
      } catch (_) {
        return Object.assign(empty, { error: 'not-json' });
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || (parsed.format && parsed.format !== EXPORT_FORMAT)) {
        return Object.assign(empty, { error: 'wrong-format' });
      }
      if (Number(parsed.schemaVersion) > SCHEMA_VERSION) return Object.assign(empty, { error: 'newer-schema' });
      var incoming = normalizeState(migrate(parsed));
      if (!incoming.valid) return Object.assign(empty, { error: 'wrong-format' });
      var state = writable();
      if (!state) return Object.assign(empty, { error: 'newer-schema' });
      var snapshot = JSON.stringify(state);
      var result = { ok: true, error: '', added: 0, updated: 0, unchanged: 0, conflicts: 0, skipped: incoming.skipped };
      for (var path in incoming.state.pages) {
        if (!own(incoming.state.pages, path)) continue;
        var sourcePage = incoming.state.pages[path];
        var target = ensurePage(state, path, null);
        if (!target.title && sourcePage.title) {
          target.title = sourcePage.title;
          result.titles = (result.titles || 0) + 1;
        }
        for (var i = 0; i < sourcePage.items.length; i++) mergeItem(target, sourcePage.items[i], result);
        sortItems(target.items);
        if (!target.items.length) delete state.pages[path];
      }
      if (size(state) > MAX_BYTES) {
        memory = JSON.parse(snapshot);
        return Object.assign(empty, { error: 'too-large' });
      }
      if (result.added || result.updated || result.conflicts || result.titles) result.ok = save(state);
      delete result.titles;
      return result;
    }

    function share(path, ids) {
      lastError = '';
      var payload = sharePayload(load(), path, ids);
      if (!payload) return '';
      var encoded = encodeShare(payload);
      if (encoded.length > MAX_SHARE_LENGTH) {
        lastError = 'share-too-large';
        return '';
      }
      return encoded;
    }

    function addShared(shared, indexes) {
      lastError = '';
      if (!shared || !PATH_PATTERN.test(shared.path)) return 0;
      var state = writable();
      if (!state) return 0;
      var snapshot = JSON.stringify(state);
      var isNew = !own(state.pages, shared.path) || !state.pages[shared.path].title;
      var target = ensurePage(state, shared.path, isNew ? { title: shared.title } : null);
      var keys = Object.create(null);
      target.items.forEach(function (item) {
        keys[shareKey(item.quote, item.note)] = true;
        if (item.originalQuote) keys[shareKey(item.originalQuote, item.note)] = true;
      });
      var added = 0;
      shared.items.forEach(function (item, index) {
        if (indexes && indexes.indexOf(index) < 0) return;
        var key = shareKey(item.quote, item.note);
        if (keys[key] || target.items.length >= MAX_ITEMS_PER_PAGE) return;
        keys[key] = true;
        var copy = normalizeItem(Object.assign({}, item, { id: newId(), createdAt: Date.now(), updatedAt: Date.now() }));
        if (copy) {
          target.items.push(copy);
          added++;
        }
      });
      if (!added) {
        memory = JSON.parse(snapshot);
        return 0;
      }
      if (size(state) > MAX_BYTES) {
        memory = JSON.parse(snapshot);
        lastError = 'full';
        return 0;
      }
      sortItems(target.items);
      save(state);
      return added;
    }

    function onChange(fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        var index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    function keepUnsaved(base, local, stored) {
      var known = Object.create(null);
      for (var storedPath in stored.pages) {
        if (!own(stored.pages, storedPath)) continue;
        stored.pages[storedPath].items.forEach(function (item) {
          known[storedPath + '\u0000' + item.id] = JSON.stringify(item);
        });
      }
      for (var path in local.pages) {
        if (!own(local.pages, path)) continue;
        var localPage = local.pages[path];
        var changed = localPage.items.filter(function (item) {
          return known[path + '\u0000' + item.id] !== JSON.stringify(item);
        });
        if (own(base.pages, path) && !base.pages[path].title && localPage.title) base.pages[path].title = localPage.title;
        if (!changed.length) continue;
        if (!own(base.pages, path)) base.pages[path] = { kind: localPage.kind, title: localPage.title, url: localPage.url, items: [] };
        var target = base.pages[path];
        if (!target.title) target.title = localPage.title;
        changed.forEach(function (item) {
          for (var i = 0; i < target.items.length; i++) {
            if (target.items[i].id !== item.id) continue;
            var untouched = known[path + '\u0000' + item.id] === JSON.stringify(target.items[i]);
            if (untouched || item.updatedAt > target.items[i].updatedAt) target.items[i] = item;
            return;
          }
          target.items.push(item);
        });
        sortItems(target.items);
      }
      for (var removedPath in unsavedRemovals) {
        if (!own(unsavedRemovals, removedPath) || !own(base.pages, removedPath)) continue;
        var gone = unsavedRemovals[removedPath];
        base.pages[removedPath].items = base.pages[removedPath].items.filter(function (item) { return !own(gone, item.id); });
        if (!base.pages[removedPath].items.length) delete base.pages[removedPath];
      }
      return base;
    }

    function reload() {
      mergeStored();
      notify({ external: true });
    }

    if (win && win.addEventListener) {
      win.addEventListener('storage', function (event) {
        if (event.key === STORAGE_KEY || event.key === null) reload();
      });
    }

    return {
      COLORS: COLORS.slice(),
      STORAGE_KEY: STORAGE_KEY,
      items: items,
      page: page,
      pages: pages,
      add: add,
      update: update,
      updateMany: updateMany,
      remove: remove,
      removeMany: removeMany,
      exportJson: exportJson,
      exportMarkdown: exportMarkdown,
      importJson: importJson,
      share: share,
      decodeShare: decodeShare,
      addShared: addShared,
      onChange: onChange,
      reload: reload,
      urlFor: urlFor,
      itemUrl: itemUrl,
      info: function () {
        load();
        return { persistent: persistent, readOnly: readOnly, lastError: lastError || loadError, operationError: lastError };
      }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_KEY: LEGACY_KEY,
    BACKUP_KEY: BACKUP_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    COLORS: COLORS,
    normalizeItem: normalizeItem,
    normalizeState: normalizeState,
    migrate: migrate,
    toMarkdown: toMarkdown,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
    urlFor: urlFor,
    itemUrl: itemUrl,
    kindOf: kindOf,
    create: create
  };
}));
