(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    try {
      root.AIFSPracticeStore = api.create(root);
    } catch (_) {
      root.AIFSPracticeStore = api.create({});
    }
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STORAGE_KEY = 'aifs:practice:v1';
  var CODE_PREFIX = 'aifs:practice:v1:code:';
  var BACKUP_KEY = 'aifs:practice:v1:unreadable';
  var SCHEMA_VERSION = 1;
  var ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_CODE = 200000;
  var MAX_DAYS = 400;
  var MAX_PROBLEMS = 2000;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function count(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function stamp(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 8640000000000000 ? Math.floor(n) : 0;
  }

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, problems: {}, days: {}, lastOpened: '', updatedAt: 0 };
  }

  function emptyProblem() {
    return { status: 'new', runs: 0, submits: 0, hints: 0, best: 0, total: 0, openedAt: 0, attemptedAt: 0, solvedAt: 0, version: '' };
  }

  function normalizeProblem(raw) {
    var item = emptyProblem();
    if (!raw || typeof raw !== 'object') return item;
    item.status = raw.status === 'solved' || raw.status === 'attempted' ? raw.status : 'new';
    item.runs = count(raw.runs);
    item.submits = count(raw.submits);
    item.hints = Math.min(count(raw.hints), 20);
    item.best = count(raw.best);
    item.total = count(raw.total);
    item.openedAt = stamp(raw.openedAt);
    item.attemptedAt = stamp(raw.attemptedAt);
    item.solvedAt = stamp(raw.solvedAt);
    item.version = typeof raw.version === 'string' ? raw.version.slice(0, 32) : '';
    if (item.status === 'solved' && !item.solvedAt) item.solvedAt = item.attemptedAt || item.openedAt || 1;
    return item;
  }

  function normalizeState(raw) {
    var state = emptyState();
    if (!raw || typeof raw !== 'object') return state;
    var problems = raw.problems && typeof raw.problems === 'object' ? raw.problems : {};
    var ids = Object.keys(problems).filter(function (id) { return ID_PATTERN.test(id); }).slice(0, MAX_PROBLEMS);
    for (var i = 0; i < ids.length; i++) state.problems[ids[i]] = normalizeProblem(problems[ids[i]]);
    var days = raw.days && typeof raw.days === 'object' ? raw.days : {};
    var keys = Object.keys(days).filter(function (day) { return DAY_PATTERN.test(day); }).sort().slice(-MAX_DAYS);
    for (var j = 0; j < keys.length; j++) {
      var n = count(days[keys[j]]);
      if (n) state.days[keys[j]] = n;
    }
    state.lastOpened = typeof raw.lastOpened === 'string' && ID_PATTERN.test(raw.lastOpened) ? raw.lastOpened : '';
    state.updatedAt = stamp(raw.updatedAt);
    return state;
  }

  function touched(item) {
    return Math.max(item.openedAt, item.attemptedAt, item.solvedAt);
  }

  function mergeStates(stored, mine) {
    var state = normalizeState(stored);
    var ours = normalizeState(mine);
    Object.keys(ours.problems).forEach(function (id) {
      var item = ours.problems[id];
      var other = own(state.problems, id) ? state.problems[id] : null;
      if (!other) {
        state.problems[id] = item;
        return;
      }
      var base = touched(item) >= touched(other) ? item : other;
      var rest = base === item ? other : item;
      ['runs', 'submits', 'hints', 'best', 'total', 'openedAt', 'attemptedAt'].forEach(function (field) {
        base[field] = Math.max(item[field], other[field]);
      });
      if (rest.status === 'solved' && base.status !== 'solved' && rest.version === base.version) {
        base.status = 'solved';
        base.solvedAt = rest.solvedAt;
      } else if (rest.status !== 'new' && base.status === 'new') {
        base.status = 'attempted';
      }
      state.problems[id] = base;
    });
    Object.keys(ours.days).forEach(function (day) {
      state.days[day] = Math.max(state.days[day] || 0, ours.days[day]);
    });
    if (ours.lastOpened && ours.updatedAt >= state.updatedAt) state.lastOpened = ours.lastOpened;
    state.updatedAt = Math.max(state.updatedAt, ours.updatedAt);
    return normalizeState(state);
  }

  function dayKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    var month = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (month.length < 2 ? '0' + month : month) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function previousDay(key) {
    var parts = key.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function create(env) {
    env = env || {};
    var storage = null;
    try {
      storage = env.localStorage || null;
    } catch (_) {
      storage = null;
    }
    var now = typeof env.now === 'function' ? env.now : function () { return Date.now(); };
    var memory = emptyState();
    var memoryCode = {};
    var writable = true;
    var locked = false;
    var codeWritable = true;
    var listeners = [];

    function readRaw(key) {
      if (!storage) return null;
      try {
        return storage.getItem(key);
      } catch (_) {
        return null;
      }
    }

    function writeRaw(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(key, value);
        return true;
      } catch (_) {
        return false;
      }
    }

    function removeRaw(key) {
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch (_) {}
    }

    function backup(text) {
      if (readRaw(BACKUP_KEY) === null) writeRaw(BACKUP_KEY, text);
    }

    function load() {
      if (locked) return memory;
      var text = readRaw(STORAGE_KEY);
      if (text === null) return memory;
      var stored;
      try {
        var parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('unreadable');
        if (parsed.schemaVersion !== undefined && parsed.schemaVersion > SCHEMA_VERSION) {
          locked = true;
          backup(text);
          return memory;
        }
        stored = normalizeState(parsed);
      } catch (_) {
        if (!writable) return memory;
        backup(text);
        stored = emptyState();
      }
      memory = writable ? stored : mergeStates(stored, memory);
      return memory;
    }

    function save(state) {
      state.updatedAt = now();
      memory = state;
      writable = !locked && writeRaw(STORAGE_KEY, JSON.stringify(state));
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](state); } catch (_) {}
      }
      return writable;
    }

    function update(fn) {
      var state = normalizeState(load());
      fn(state);
      save(state);
      return state;
    }

    function entry(state, id) {
      if (!own(state.problems, id)) state.problems[id] = emptyProblem();
      return state.problems[id];
    }

    function check(id) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('invalid problem id');
    }

    function markDay(state, time) {
      var key = dayKey(time);
      state.days[key] = (state.days[key] || 0) + 1;
      var keys = Object.keys(state.days).sort();
      while (keys.length > MAX_DAYS) delete state.days[keys.shift()];
    }

    return {
      key: STORAGE_KEY,
      state: function () {
        return normalizeState(load());
      },
      problem: function (id) {
        check(id);
        var state = load();
        return normalizeProblem(own(state.problems, id) ? state.problems[id] : null);
      },
      status: function (id) {
        return this.problem(id).status;
      },
      open: function (id, version) {
        check(id);
        return update(function (state) {
          var item = entry(state, id);
          item.openedAt = now();
          if (typeof version === 'string') {
            var next = version.slice(0, 32);
            if (next && item.version !== next && item.status === 'solved') {
              item.status = 'attempted';
              item.solvedAt = 0;
            }
            item.version = next;
          }
          state.lastOpened = id;
        }).problems[id];
      },
      record: function (id, kind, passed, total) {
        check(id);
        var time = now();
        return update(function (state) {
          var item = entry(state, id);
          if (kind === 'submit') item.submits += 1;
          else item.runs += 1;
          item.attemptedAt = time;
          state.lastOpened = id;
          if (kind === 'submit') {
            item.best = Math.max(item.best, count(passed));
            item.total = Math.max(item.total, count(total));
          }
          if (kind === 'submit' && count(total) > 0 && count(passed) === count(total)) {
            if (item.status !== 'solved') item.solvedAt = time;
            item.status = 'solved';
          } else if (item.status !== 'solved') {
            item.status = 'attempted';
          }
          markDay(state, time);
        }).problems[id];
      },
      revealHint: function (id, shown) {
        check(id);
        return update(function (state) {
          var item = entry(state, id);
          item.hints = Math.max(item.hints, Math.min(count(shown), 20));
        }).problems[id].hints;
      },
      saveCode: function (id, code) {
        check(id);
        var text = String(code == null ? '' : code).slice(0, MAX_CODE);
        memoryCode[id] = text;
        codeWritable = writeRaw(CODE_PREFIX + id, JSON.stringify({ code: text, savedAt: now() }));
        return codeWritable;
      },
      loadCode: function (id) {
        check(id);
        if (own(memoryCode, id)) return memoryCode[id];
        var text = readRaw(CODE_PREFIX + id);
        if (text !== null) {
          try {
            var parsed = JSON.parse(text);
            if (parsed && typeof parsed.code === 'string') return parsed.code;
          } catch (_) {}
        }
        return own(memoryCode, id) ? memoryCode[id] : null;
      },
      clearCode: function (id) {
        check(id);
        delete memoryCode[id];
        removeRaw(CODE_PREFIX + id);
      },
      counts: function (ids) {
        var state = load();
        var out = { solved: 0, attempted: 0, total: ids.length };
        for (var i = 0; i < ids.length; i++) {
          var item = own(state.problems, ids[i]) ? state.problems[ids[i]] : null;
          if (!item) continue;
          if (item.status === 'solved') out.solved += 1;
          else if (item.status === 'attempted') out.attempted += 1;
        }
        return out;
      },
      streak: function (time) {
        var state = load();
        var key = dayKey(time === undefined ? now() : time);
        if (!state.days[key]) key = previousDay(key);
        var days = 0;
        while (state.days[key]) {
          days += 1;
          key = previousDay(key);
        }
        return days;
      },
      continueTarget: function (ids) {
        var state = load();
        var known = ids.filter(function (id) { return own(state.problems, id); });
        if (state.lastOpened && ids.indexOf(state.lastOpened) >= 0 && state.problems[state.lastOpened] && state.problems[state.lastOpened].status !== 'solved') return state.lastOpened;
        var open = known.filter(function (id) { return state.problems[id].status === 'attempted'; });
        open.sort(function (a, b) { return state.problems[b].attemptedAt - state.problems[a].attemptedAt; });
        if (open.length) return open[0];
        if (!known.length) return '';
        for (var i = 0; i < ids.length; i++) {
          if (!own(state.problems, ids[i]) || state.problems[ids[i]].status !== 'solved') return ids[i];
        }
        return '';
      },
      randomUnsolved: function (ids, random) {
        var state = load();
        var pick = typeof random === 'function' ? random : Math.random;
        var open = ids.filter(function (id) { return !own(state.problems, id) || state.problems[id].status !== 'solved'; });
        if (!open.length) return '';
        var fresh = open.filter(function (id) { return !own(state.problems, id) || state.problems[id].status === 'new'; });
        var pool = fresh.length ? fresh : open;
        return pool[Math.min(pool.length - 1, Math.floor(pick() * pool.length))];
      },
      writable: function () {
        return writable && codeWritable;
      },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var index = listeners.indexOf(fn);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
      reload: function () {
        return normalizeState(load());
      }
    };
  }

  return { create: create, dayKey: dayKey, normalizeState: normalizeState, STORAGE_KEY: STORAGE_KEY, CODE_PREFIX: CODE_PREFIX, BACKUP_KEY: BACKUP_KEY, SCHEMA_VERSION: SCHEMA_VERSION };
}));
