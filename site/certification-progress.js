/**
 * Local-only certification assessment progress.
 *
 * Lesson completion remains in progress.js. Assessment progress is stored per
 * assessment so two tabs working on different mocks cannot overwrite one
 * another. Attempts use immutable entries, which also prevents simultaneous
 * submissions from losing history. Only the latest five keep full detail;
 * older entries become compact best-score summaries. Existing v1 aggregate
 * data is migrated on demand and remains readable.
 */
(function () {
  'use strict';

  var LEGACY_STORAGE_KEY = 'aifs:cert-progress:v1';
  var STORAGE_PREFIX = 'aifs:cert-progress:v2:';
  var STORAGE_VERSION = 2;
  var HISTORY_LIMIT = 5;
  var listeners = [];
  var persistenceAvailable = null;
  var volatileState = emptyState();
  var migratedKeys = Object.create(null);
  var clearedDrafts = Object.create(null);
  var writerId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  var writeCounter = 0;

  function emptyState() {
    return { drafts: {}, attempts: {}, bests: {}, updatedAt: 0 };
  }

  function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function isAnswerMap(value) {
    return isRecord(value) && Object.keys(value).every(function (key) {
      var choices = value[key];
      var seen = Object.create(null);
      return !!key && Array.isArray(choices) && choices.every(function (choice) {
        if (seen[choice]) return false;
        seen[choice] = true;
        return isFiniteNumber(choice) && Math.floor(choice) === choice && choice >= 0;
      });
    });
  }

  function isDomainScoreMap(value) {
    return isRecord(value) && Object.keys(value).every(function (key) {
      var score = value[key];
      return !!key && isRecord(score) &&
        isFiniteNumber(score.correct) && Math.floor(score.correct) === score.correct &&
        isFiniteNumber(score.total) && Math.floor(score.total) === score.total &&
        score.total > 0 && score.correct >= 0 && score.correct <= score.total;
    });
  }

  function isDraftShape(draft, version) {
    if (!isRecord(draft) || !isAnswerMap(draft.answers)) return false;
    if (!isFiniteNumber(draft.startedAt) || draft.startedAt <= 0) return false;
    if (!isFiniteNumber(draft.deadlineAt) || draft.deadlineAt < 0) return false;
    if (draft.version == null) return false;
    return version == null || String(draft.version) === String(version);
  }

  function isAttemptShape(attempt, version) {
    if (!isRecord(attempt) || !isAnswerMap(attempt.answers)) return false;
    if (!isFiniteNumber(attempt.correct) || !isFiniteNumber(attempt.total) || attempt.total <= 0) return false;
    if (attempt.correct < 0 || attempt.correct > attempt.total) return false;
    if (!isFiniteNumber(attempt.percent) || attempt.percent < 0 || attempt.percent > 100) return false;
    if (!isDomainScoreMap(attempt.domains)) return false;
    if (!isFiniteNumber(attempt.startedAt) || !isFiniteNumber(attempt.submittedAt) || !isFiniteNumber(attempt.durationMs)) return false;
    if (attempt.startedAt <= 0 || attempt.submittedAt < attempt.startedAt || attempt.durationMs < 0) return false;
    if (attempt.version == null) return false;
    return version == null || String(attempt.version) === String(version);
  }

  function bestSummary(attempt) {
    if (!isRecord(attempt) || !isFiniteNumber(attempt.percent) || attempt.percent < 0 || attempt.percent > 100) return null;
    var summary = { percent: attempt.percent };
    ['correct', 'total', 'submittedAt', 'version'].forEach(function (name) {
      if (isFiniteNumber(attempt[name])) summary[name] = attempt[name];
    });
    return summary;
  }

  function betterBest(candidate, current) {
    if (!candidate) return current || null;
    if (!current || candidate.percent > current.percent) return candidate;
    return current;
  }

  function normalizeState(value) {
    var state = emptyState();
    if (!isRecord(value)) return state;

    if (isRecord(value.drafts)) {
      Object.keys(value.drafts).forEach(function (key) {
        var draft = value.drafts[key];
        if (isDraftShape(draft)) state.drafts[key] = draft;
      });
    }
    if (isRecord(value.attempts)) {
      Object.keys(value.attempts).forEach(function (key) {
        if (!Array.isArray(value.attempts[key])) return;
        state.attempts[key] = value.attempts[key].filter(function (attempt) {
          return isAttemptShape(attempt);
        }).slice(0, HISTORY_LIMIT);
      });
    }
    if (isRecord(value.bests)) {
      Object.keys(value.bests).forEach(function (key) {
        var summary = bestSummary(value.bests[key]);
        if (summary) state.bests[key] = summary;
      });
    }
    Object.keys(state.attempts).forEach(function (key) {
      state.attempts[key].forEach(function (attempt) {
        state.bests[key] = betterBest(bestSummary(attempt), state.bests[key]);
      });
    });
    state.updatedAt = isFiniteNumber(value.updatedAt) ? value.updatedAt : 0;
    return state;
  }

  function isPersistent() {
    if (persistenceAvailable !== null) return persistenceAvailable;
    try {
      var probe = LEGACY_STORAGE_KEY + ':probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      persistenceAvailable = true;
    } catch (_) {
      persistenceAvailable = false;
    }
    return persistenceAvailable;
  }

  function canWrite() {
    if (persistenceAvailable !== true) persistenceAvailable = null;
    return isPersistent();
  }

  function isReadable() {
    try {
      localStorage.getItem(LEGACY_STORAGE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  function volatileAttempts(key) {
    return Array.isArray(volatileState.attempts[key]) ? volatileState.attempts[key] : [];
  }

  function newestFirst(attempts) {
    return attempts.slice().sort(function (left, right) {
      return right.submittedAt - left.submittedAt;
    });
  }

  function readJson(storageKey) {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch (_) {
      return null;
    }
  }

  function writeJson(storageKey, value) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch (_) {
      persistenceAvailable = false;
      return false;
    }
  }

  function removeStored(storageKey) {
    try {
      localStorage.removeItem(storageKey);
      return true;
    } catch (_) {
      persistenceAvailable = false;
      return false;
    }
  }

  function storedKeys(prefix) {
    var keys = [];
    try {
      for (var index = 0; index < localStorage.length; index += 1) {
        var key = localStorage.key(index);
        if (key && key.indexOf(prefix) === 0) keys.push(key);
      }
    } catch (_) {}
    return keys;
  }

  function readLegacy() {
    if (!isReadable()) return emptyState();
    return normalizeState(readJson(LEGACY_STORAGE_KEY));
  }

  function assessmentKey(id, version) {
    return id ? id + '@' + String(version == null ? 1 : version) : '';
  }

  function versionFromKey(key) {
    var separator = key.lastIndexOf('@');
    return separator < 0 ? null : key.slice(separator + 1);
  }

  function assessmentStorageKey(key) {
    return STORAGE_PREFIX + encodeURIComponent(key);
  }

  function attemptPrefix(key) {
    return assessmentStorageKey(key) + ':attempt:';
  }

  function summaryPrefix(key) {
    return assessmentStorageKey(key) + ':summary:';
  }

  function nextEntryId() {
    writeCounter += 1;
    return Date.now().toString(36) + '-' + writerId + '-' + writeCounter.toString(36);
  }

  function legacyEntryId(attempt, index) {
    return 'legacy-' + [
      attempt.submittedAt,
      attempt.startedAt,
      attempt.durationMs,
      attempt.correct,
      attempt.total,
      index,
    ].join('-');
  }

  function readAssessmentMeta(key) {
    var raw = readJson(assessmentStorageKey(key));
    if (!isRecord(raw) || raw.schemaVersion !== STORAGE_VERSION) return null;
    return {
      schemaVersion: STORAGE_VERSION,
      draft: isDraftShape(raw.draft, versionFromKey(key)) ? raw.draft : null,
      updatedAt: isFiniteNumber(raw.updatedAt) ? raw.updatedAt : 0,
    };
  }

  function writeAssessmentMeta(key, draft) {
    return writeJson(assessmentStorageKey(key), {
      schemaVersion: STORAGE_VERSION,
      draft: draft,
      updatedAt: Date.now(),
    });
  }

  function ensureLegacyEntries(key, legacyState) {
    if (migratedKeys[key]) return;
    var legacy = legacyState || readLegacy();
    var history = Array.isArray(legacy.attempts[key]) ? legacy.attempts[key] : [];
    var complete = true;

    history.forEach(function (attempt, index) {
      var entryKey = attemptPrefix(key) + legacyEntryId(attempt, index);
      if (readJson(entryKey) === null && !writeJson(entryKey, attempt)) complete = false;
    });

    if (legacy.bests[key]) {
      var summaryKey = summaryPrefix(key) + 'legacy-best';
      var existing = bestSummary(readJson(summaryKey));
      var merged = betterBest(bestSummary(legacy.bests[key]), existing);
      if (merged && (!existing || merged.percent !== existing.percent) && !writeJson(summaryKey, merged)) complete = false;
    }
    if (complete) migratedKeys[key] = true;
  }

  function listAttempts(key) {
    var version = versionFromKey(key);
    return storedKeys(attemptPrefix(key)).map(function (storageKey) {
      var attempt = readJson(storageKey);
      if (!isAttemptShape(attempt, version)) return null;
      return { id: storageKey.slice(attemptPrefix(key).length), attempt: attempt, storageKey: storageKey };
    }).filter(function (entry) {
      return !!entry;
    }).sort(function (left, right) {
      if (left.attempt.submittedAt !== right.attempt.submittedAt) {
        return right.attempt.submittedAt - left.attempt.submittedAt;
      }
      return right.id.localeCompare(left.id);
    });
  }

  function listSummaries(key) {
    return storedKeys(summaryPrefix(key)).map(function (storageKey) {
      var summary = bestSummary(readJson(storageKey));
      return summary ? { summary: summary, storageKey: storageKey } : null;
    }).filter(function (entry) {
      return !!entry;
    });
  }

  function compactAttempts(key) {
    var records = listAttempts(key);
    records.slice(HISTORY_LIMIT).forEach(function (record) {
      var summary = bestSummary(record.attempt);
      if (!summary) return;
      if (writeJson(summaryPrefix(key) + record.id, summary)) removeStored(record.storageKey);
    });
  }

  function collectAssessmentKeys(legacy) {
    var found = Object.create(null);
    ['drafts', 'attempts', 'bests'].forEach(function (section) {
      Object.keys(legacy[section]).forEach(function (key) { found[key] = true; });
    });
    storedKeys(STORAGE_PREFIX).forEach(function (storageKey) {
      var suffix = storageKey.slice(STORAGE_PREFIX.length);
      var separator = suffix.indexOf(':');
      var encodedKey = separator < 0 ? suffix : suffix.slice(0, separator);
      try {
        if (encodedKey) found[decodeURIComponent(encodedKey)] = true;
      } catch (_) {}
    });
    return Object.keys(found);
  }

  function mergeVolatile(state) {
    Object.keys(volatileState.drafts).forEach(function (key) {
      state.drafts[key] = volatileState.drafts[key];
    });
    Object.keys(volatileState.attempts).forEach(function (key) {
      state.attempts[key] = newestFirst((state.attempts[key] || []).concat(volatileAttempts(key))).slice(0, HISTORY_LIMIT);
    });
    Object.keys(volatileState.bests).forEach(function (key) {
      state.bests[key] = betterBest(volatileState.bests[key], state.bests[key]);
    });
    state.updatedAt = Math.max(state.updatedAt, volatileState.updatedAt);
    return state;
  }

  function readAllState() {
    if (!isReadable()) return normalizeState(volatileState);
    var legacy = readLegacy();
    var state = emptyState();

    collectAssessmentKeys(legacy).forEach(function (key) {
      ensureLegacyEntries(key, legacy);
      var meta = readAssessmentMeta(key);
      var draft = meta ? meta.draft : legacy.drafts[key];
      var records = listAttempts(key);
      var best = null;

      if (draft && isDraftShape(draft, versionFromKey(key)) && clearedDrafts[key] !== draft.startedAt) state.drafts[key] = draft;
      state.attempts[key] = records.slice(0, HISTORY_LIMIT).map(function (record) {
        return record.attempt;
      });
      records.forEach(function (record) {
        best = betterBest(bestSummary(record.attempt), best);
        state.updatedAt = Math.max(state.updatedAt, record.attempt.submittedAt);
      });
      listSummaries(key).forEach(function (record) {
        best = betterBest(record.summary, best);
      });
      if (best) state.bests[key] = best;
      if (meta) state.updatedAt = Math.max(state.updatedAt, meta.updatedAt);
    });
    state.updatedAt = Math.max(state.updatedAt, legacy.updatedAt);
    return mergeVolatile(state);
  }

  function notify(state) {
    var next = state || readAllState();
    listeners.slice().forEach(function (fn) {
      try { fn(next); } catch (_) {}
    });
  }

  function storedDraft(key, version) {
    if (!isReadable()) return null;
    var meta = readAssessmentMeta(key);
    var draft = meta ? meta.draft : readLegacy().drafts[key] || null;
    if (!draft || !isDraftShape(draft, version) || clearedDrafts[key] === draft.startedAt) return null;
    return draft;
  }

  function getDraft(id, version) {
    var key = assessmentKey(id, version);
    if (!key) return null;
    var volatileDraft = volatileState.drafts[key] || null;
    var stored = storedDraft(key, version);
    if (!volatileDraft || !isDraftShape(volatileDraft, version)) return stored;
    return stored && stored.startedAt > volatileDraft.startedAt ? stored : volatileDraft;
  }

  function saveDraft(id, version, draft) {
    var key = assessmentKey(id, version);
    if (!key || !isDraftShape(draft, version)) return;
    if (canWrite() && writeAssessmentMeta(key, draft)) {
      delete volatileState.drafts[key];
      notify();
      return;
    }
    volatileState.drafts[key] = draft;
    volatileState.updatedAt = Date.now();
    notify();
  }

  function clearDraft(id, version) {
    var key = assessmentKey(id, version);
    if (!key) return;
    var changed = false;
    if (volatileState.drafts[key]) {
      delete volatileState.drafts[key];
      volatileState.updatedAt = Date.now();
      changed = true;
    }
    var stored = storedDraft(key, version);
    if (stored) {
      if (!canWrite() || !writeAssessmentMeta(key, null)) clearedDrafts[key] = stored.startedAt;
      changed = true;
    }
    if (changed) notify();
  }

  function recordAttempt(id, version, attempt) {
    var key = assessmentKey(id, version);
    if (!key || !isAttemptShape(attempt, version)) return false;
    delete volatileState.drafts[key];
    if (canWrite()) {
      ensureLegacyEntries(key);
      if (writeJson(attemptPrefix(key) + nextEntryId(), attempt)) {
        writeAssessmentMeta(key, null);
        compactAttempts(key);
        notify();
        return true;
      }
    }
    var volatileHistory = volatileAttempts(key);
    volatileHistory.unshift(attempt);
    volatileState.attempts[key] = volatileHistory.slice(0, HISTORY_LIMIT);
    volatileState.bests[key] = betterBest(bestSummary(attempt), volatileState.bests[key]);
    volatileState.updatedAt = Date.now();
    notify();
    return false;
  }

  function unmigratedLegacy(key) {
    if (migratedKeys[key]) return { attempts: [], best: null };
    var legacy = readLegacy();
    var history = Array.isArray(legacy.attempts[key]) ? legacy.attempts[key] : [];
    return {
      attempts: history.filter(function (attempt, index) {
        return isAttemptShape(attempt, versionFromKey(key)) && readJson(attemptPrefix(key) + legacyEntryId(attempt, index)) === null;
      }),
      best: bestSummary(legacy.bests[key]),
    };
  }

  function getAttempts(id, version) {
    var key = assessmentKey(id, version);
    if (!key) return [];
    var extra = volatileAttempts(key);
    if (!isReadable()) return extra;
    ensureLegacyEntries(key);
    var stored = listAttempts(key).map(function (record) {
      return record.attempt;
    });
    extra = extra.concat(unmigratedLegacy(key).attempts);
    return (extra.length ? newestFirst(stored.concat(extra)) : stored).slice(0, HISTORY_LIMIT);
  }

  function getBest(id, version) {
    var key = assessmentKey(id, version);
    if (!key) return null;
    var best = volatileState.bests[key] || null;
    if (!isReadable()) return best;
    ensureLegacyEntries(key);
    best = betterBest(unmigratedLegacy(key).best, best);
    listAttempts(key).forEach(function (record) {
      best = betterBest(bestSummary(record.attempt), best);
    });
    listSummaries(key).forEach(function (record) {
      best = betterBest(record.summary, best);
    });
    return best;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== null && event.key !== LEGACY_STORAGE_KEY && event.key.indexOf(STORAGE_PREFIX) !== 0) return;
    if (event.key === null || event.key === LEGACY_STORAGE_KEY) migratedKeys = Object.create(null);
    notify();
  });

  window.AIFSCertProgress = {
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    recordAttempt: recordAttempt,
    getAttempts: getAttempts,
    getBest: getBest,
    onChange: onChange,
    isPersistent: isPersistent,
  };
}());
