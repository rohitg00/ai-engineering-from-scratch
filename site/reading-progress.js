/**
 * Reading progress tracker.
 *
 * Extends the base progress.js (quiz/completion) with scroll position,
 * reading time, and completion percentage per lesson. Data is stored
 * per user in localStorage.
 *
 * Schema (versioned):
 *
 *   aifs:reading-progress:v1 = {
 *     "<user-key>": {
 *       "<lesson-path>": {
 *         scrollPct: number,     // 0-100, last known scroll depth
 *         readSeconds: number,   // cumulative time on page
 *         lastOpened: number,    // timestamp
 *         completed: boolean     // true when scrollPct > 90
 *       }
 *     }
 *   }
 */
(function () {
  var STORAGE_KEY = 'aifs:reading-progress:v1';
  var SAVE_INTERVAL_MS = 5000;
  var listeners = [];
  var saveTimer = null;
  var sessionStart = 0;
  var currentPath = '';
  var activeScrollHandler = null;

  function userKey() {
    if (window.AIFSAuth && window.AIFSAuth.isLoggedIn()) {
      var u = window.AIFSAuth.currentUser();
      return u ? u.email : 'anonymous';
    }
    return 'anonymous';
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    notifyListeners();
  }

  function ensureUser(data) {
    var key = userKey();
    if (!data[key]) data[key] = {};
    return data[key];
  }

  function getProgress(path) {
    if (!path) return null;
    var all = readAll();
    var userData = all[userKey()];
    if (!userData) return null;
    return userData[path] || null;
  }

  function saveProgress(path, data) {
    if (!path) return;
    var all = readAll();
    var userData = ensureUser(all);
    var existing = userData[path] || { scrollPct: 0, readSeconds: 0, lastOpened: 0, completed: false };
    existing.scrollPct = Math.max(existing.scrollPct || 0, data.scrollPct || 0);
    existing.readSeconds = (existing.readSeconds || 0) + (data.readSeconds || 0);
    existing.lastOpened = data.lastOpened || Date.now();
    if (data.completed) existing.completed = true;
    userData[path] = existing;
    writeAll(all);
  }

  function getLastLesson() {
    var all = readAll();
    var userData = all[userKey()];
    if (!userData) return null;

    var best = null;
    var bestTime = 0;
    for (var path in userData) {
      if (!userData.hasOwnProperty(path)) continue;
      var p = userData[path];
      if (p.lastOpened > bestTime) {
        bestTime = p.lastOpened;
        best = { path: path, scrollPct: p.scrollPct || 0, completed: p.completed || false, lastOpened: p.lastOpened };
      }
    }
    return best;
  }

  function getProgressPct(path) {
    var p = getProgress(path);
    if (!p) return 0;
    return Math.min(100, Math.round(p.scrollPct || 0));
  }

  function getAllProgress() {
    var all = readAll();
    var userData = all[userKey()];
    if (!userData) return {};
    return userData;
  }

  function startTracking(path) {
    stopTracking();
    currentPath = path;
    sessionStart = Date.now();

    var lastSave = Date.now();
    activeScrollHandler = function () {
      var now = Date.now();
      var elapsed = (now - lastSave) / 1000;
      if (elapsed < SAVE_INTERVAL_MS / 1000) return;
      lastSave = now;
      persistNow();
    };

    window.addEventListener('scroll', activeScrollHandler, { passive: true });

    window.addEventListener('beforeunload', persistNow);
  }

  function stopTracking() {
    if (currentPath) persistNow();
    if (activeScrollHandler) {
      window.removeEventListener('scroll', activeScrollHandler);
      activeScrollHandler = null;
    }
    window.removeEventListener('beforeunload', persistNow);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    currentPath = '';
    sessionStart = 0;
  }

  function persistNow() {
    if (!currentPath) return;
    var scrollPct = calcScrollPct();
    var readSeconds = (Date.now() - sessionStart) / 1000;
    var completed = scrollPct > 90;
    saveProgress(currentPath, {
      scrollPct: scrollPct,
      readSeconds: readSeconds,
      lastOpened: Date.now(),
      completed: completed
    });
    sessionStart = Date.now();

    if (window.AIFSStreak) {
      var minutes = readSeconds / 60;
      window.AIFSStreak.updateStreak(minutes);
    }
  }

  function calcScrollPct() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
  }

  function resetProgress(path) {
    var all = readAll();
    var userData = all[userKey()];
    if (userData && path) {
      delete userData[path];
      writeAll(all);
    } else if (!path) {
      delete all[userKey()];
      writeAll(all);
    }
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function notifyListeners() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (_) {}
    }
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    notifyListeners();
  });

  window.AIFSReadingProgress = {
    getProgress: getProgress,
    saveProgress: saveProgress,
    getLastLesson: getLastLesson,
    getProgressPct: getProgressPct,
    getAllProgress: getAllProgress,
    startTracking: startTracking,
    stopTracking: stopTracking,
    persistNow: persistNow,
    resetProgress: resetProgress,
    onChange: onChange
  };
})();
