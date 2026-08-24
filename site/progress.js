/**
 * Local-only progress tracker.
 *
 * Stores everything in the learner's browser. No account, server, or network
 * request is involved. Version 2 keeps lesson work and quiz understanding as
 * separate signals while preserving version 1 completion history.
 *
 *   aifs:progress:v2 = {
 *     schemaVersion: 2,
 *     lessons: {
 *       "<lesson-path>": {
 *         answers: { "<qid>": { picked, correct, t } },
 *         quizPassedAt: number | null,
 *         checkpoints: {
 *           readAt: number | null,
 *           builtAt: number | null,
 *           ranAt: number | null,
 *           evidenceAt: number | null
 *         },
 *         completedAt: number | null,
 *         completionSource: string,
 *         visitedAt: number
 *       }
 *     },
 *     updatedAt: number
 *   }
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'aifs:progress:v2';
  var LEGACY_STORAGE_KEY = 'aifs:progress:v1';
  var CHECKPOINT_FIELDS = {
    read: 'readAt',
    built: 'builtAt',
    ran: 'ranAt',
    evidence: 'evidenceAt'
  };
  var listeners = [];

  function emptyCheckpoints() {
    return { readAt: null, builtAt: null, ranAt: null, evidenceAt: null };
  }

  function emptyLesson() {
    return {
      answers: {},
      quizPassedAt: null,
      checkpoints: emptyCheckpoints(),
      completedAt: null,
      completionSource: '',
      visitedAt: 0
    };
  }

  function emptyState() {
    return { schemaVersion: 2, lessons: {}, updatedAt: 0 };
  }

  function timestamp(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  }

  function normalizeLesson(raw, fromLegacy) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var checkpoints = raw.checkpoints && typeof raw.checkpoints === 'object'
      ? raw.checkpoints
      : {};
    var legacyCompletion = timestamp(raw.completedAt);
    var lesson = {
      answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
      quizPassedAt: timestamp(raw.quizPassedAt) || (fromLegacy ? legacyCompletion : null),
      checkpoints: {
        readAt: timestamp(checkpoints.readAt),
        builtAt: timestamp(checkpoints.builtAt),
        ranAt: timestamp(checkpoints.ranAt),
        evidenceAt: timestamp(checkpoints.evidenceAt)
      },
      completedAt: legacyCompletion,
      completionSource: String(raw.completionSource || (fromLegacy && legacyCompletion ? 'migrated-v1' : '')),
      visitedAt: timestamp(raw.visitedAt) || 0
    };
    if (raw.quizVersion !== undefined) lesson.quizVersion = raw.quizVersion;
    return lesson;
  }

  function normalizeState(raw, fromLegacy) {
    var state = emptyState();
    if (!raw || typeof raw !== 'object' || !raw.lessons || typeof raw.lessons !== 'object') return state;
    for (var path in raw.lessons) {
      if (!Object.prototype.hasOwnProperty.call(raw.lessons, path)) continue;
      state.lessons[path] = normalizeLesson(raw.lessons[path], fromLegacy);
    }
    state.updatedAt = timestamp(raw.updatedAt) || 0;
    return state;
  }

  function parseStored(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function persistWithoutNotification(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function read() {
    var current = parseStored(STORAGE_KEY);
    if (current) return normalizeState(current, false);

    var legacy = parseStored(LEGACY_STORAGE_KEY);
    if (!legacy) return emptyState();
    var migrated = normalizeState(legacy, true);
    persistWithoutNotification(migrated);
    return migrated;
  }

  function notify(state) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (_) {}
    }
  }

  function write(state) {
    state.schemaVersion = 2;
    state.updatedAt = Date.now();
    persistWithoutNotification(state);
    notify(state);
  }

  function ensureLesson(state, path) {
    if (!state.lessons[path]) state.lessons[path] = emptyLesson();
    else state.lessons[path] = normalizeLesson(state.lessons[path], false);
    return state.lessons[path];
  }

  function recordVisit(path) {
    if (!path) return;
    var state = read();
    ensureLesson(state, path).visitedAt = Date.now();
    write(state);
  }

  function recordAnswer(path, qid, picked, correct) {
    if (!path || !qid) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    lesson.answers[qid] = { picked: picked, correct: !!correct, t: Date.now() };
    write(state);
  }

  function markQuizPassed(path) {
    if (!path) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    if (lesson.quizPassedAt) return;
    lesson.quizPassedAt = Date.now();
    write(state);
  }

  function unmarkQuizPassed(path) {
    if (!path) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    if (!lesson.quizPassedAt) return;
    lesson.quizPassedAt = null;
    write(state);
  }

  function setCheckpoint(path, checkpoint, complete) {
    var field = CHECKPOINT_FIELDS[checkpoint];
    if (!path || !field) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    var next = complete === false ? null : Date.now();
    if (!!lesson.checkpoints[field] === !!next) return;
    lesson.checkpoints[field] = next;
    write(state);
  }

  function toggleCheckpoint(path, checkpoint) {
    var field = CHECKPOINT_FIELDS[checkpoint];
    if (!path || !field) return;
    var lesson = getLessonProgress(path);
    setCheckpoint(path, checkpoint, !lesson.checkpoints[field]);
  }

  function markLessonComplete(path, source) {
    if (!path) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    if (lesson.completedAt) return;
    lesson.completedAt = Date.now();
    lesson.completionSource = String(source || 'learner');
    write(state);
  }

  function unmarkLessonComplete(path) {
    if (!path) return;
    var state = read();
    var lesson = ensureLesson(state, path);
    if (!lesson.completedAt) return;
    lesson.completedAt = null;
    lesson.completionSource = '';
    write(state);
  }

  function getLessonProgress(path) {
    if (!path) return null;
    var state = read();
    return state.lessons[path] ? normalizeLesson(state.lessons[path], false) : emptyLesson();
  }

  function isLessonComplete(path) {
    var progress = getLessonProgress(path);
    return !!(progress && progress.completedAt);
  }

  function hasLessonActivity(path) {
    var progress = getLessonProgress(path);
    if (!progress) return false;
    var checkpoints = progress.checkpoints || emptyCheckpoints();
    return !!(
      progress.visitedAt ||
      progress.quizPassedAt ||
      progress.completedAt ||
      Object.keys(progress.answers || {}).length ||
      checkpoints.readAt || checkpoints.builtAt || checkpoints.ranAt || checkpoints.evidenceAt
    );
  }

  function countCompletedFromUrls(urls) {
    var state = read();
    var n = 0;
    for (var i = 0; i < urls.length; i++) {
      var path = extractPath(urls[i]);
      if (path && state.lessons[path] && state.lessons[path].completedAt) n++;
    }
    return n;
  }

  function extractPath(url) {
    if (!url) return '';
    var match = String(url).match(/(phases\/[^/]+\/[^/]+)\/?/);
    return match ? match[1] : '';
  }

  function totalCompleted() {
    var state = read();
    var n = 0;
    for (var path in state.lessons) {
      if (state.lessons[path].completedAt) n++;
    }
    return n;
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}
    notify(emptyState());
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return;
    notify(read());
  });

  window.AIFSProgress = {
    recordVisit: recordVisit,
    recordAnswer: recordAnswer,
    markQuizPassed: markQuizPassed,
    unmarkQuizPassed: unmarkQuizPassed,
    setCheckpoint: setCheckpoint,
    toggleCheckpoint: toggleCheckpoint,
    markLessonComplete: markLessonComplete,
    unmarkLessonComplete: unmarkLessonComplete,
    getLessonProgress: getLessonProgress,
    isLessonComplete: isLessonComplete,
    hasLessonActivity: hasLessonActivity,
    countCompletedFromUrls: countCompletedFromUrls,
    extractPath: extractPath,
    totalCompleted: totalCompleted,
    reset: reset,
    onChange: onChange
  };
}());
