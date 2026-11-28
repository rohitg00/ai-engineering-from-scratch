/**
 * Local-first progress store.
 *
 * One account, no server. Everything lives in localStorage and survives a
 * reload. The shape is small on purpose: XP, a day ledger, per-lesson progress,
 * flashcards, exercise ticks, and notes.
 */

const KEY = 'workbench.v1';
const listeners = new Set();

const EMPTY = () => ({
  v: 1,
  xp: 0,
  days: {},
  lessons: {},
  cards: {},
  tasks: {},
  notes: {},
  theme: 'light',
  startedAt: new Date().toISOString(),
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return EMPTY();
    return { ...EMPTY(), ...parsed };
  } catch {
    return EMPTY();
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the session still works in memory */
  }
}

function emit() {
  save();
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

/* ------------------------------------------------------------------ dates */

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

/* --------------------------------------------------------------------- xp */

export function addXp(amount) {
  if (!amount) return;
  state.xp += amount;
  const key = dayKey();
  state.days[key] = (state.days[key] || 0) + amount;
  emit();
}

export function xpForLevel(level) {
  return Math.round((level - 1) ** 2 * 110);
}

export function levelForXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 110)) + 1;
}

export function levelInfo() {
  const level = levelForXp(state.xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    start,
    next,
    toNext: Math.max(0, next - state.xp),
    percent: Math.min(100, Math.round(((state.xp - start) / Math.max(1, next - start)) * 100)),
  };
}

export function streak() {
  const days = state.days;
  let cursor = dayKey();
  if (!days[cursor]) {
    cursor = shiftDay(cursor, -1);
    if (!days[cursor]) return 0;
  }
  let count = 0;
  while (days[cursor]) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function activeToday() {
  return Boolean(state.days[dayKey()]);
}

/* ---------------------------------------------------------------- lessons */

export function lessonState(id) {
  return state.lessons[id] ?? null;
}

function ensureLesson(id) {
  if (!state.lessons[id]) {
    state.lessons[id] = {
      startedAt: new Date().toISOString(),
      step: 0,
      furthest: 0,
      done: false,
      quiz: {},
      earned: 0,
    };
  }
  state.lastLesson = id;
  return state.lessons[id];
}

export function lastLesson() {
  return state.lastLesson ?? null;
}

/**
 * Move to a step. XP is only granted for steps never reached before, so
 * jumping back and forth never farms the meter.
 */
export function reachStep(id, index) {
  const lesson = ensureLesson(id);
  if (index > lesson.furthest) {
    const gained = (index - lesson.furthest) * 4;
    lesson.furthest = index;
    lesson.step = index;
    lesson.earned += gained;
    addXp(gained);
    return;
  }
  lesson.step = index;
  emit();
}

export function setStep(id, index) {
  const lesson = ensureLesson(id);
  lesson.step = index;
  emit();
}

export function completeLesson(id) {
  const lesson = ensureLesson(id);
  if (lesson.done) return false;
  lesson.done = true;
  lesson.completedAt = new Date().toISOString();
  lesson.earned += 20;
  addXp(20);
  return true;
}

export function recordQuizAnswer(id, questionId, correct) {
  const lesson = ensureLesson(id);
  if (lesson.quiz[questionId] !== undefined) return;
  lesson.quiz[questionId] = correct;
  if (correct) {
    lesson.earned += 8;
    addXp(8);
  } else {
    emit();
  }
}

export function recordRecall(id, rating) {
  const lesson = ensureLesson(id);
  if (lesson.recall) return;
  lesson.recall = rating;
  lesson.earned += 6;
  addXp(6);
}

/* ------------------------------------------------------------------ tasks */

export function taskSet(id) {
  return new Set(state.tasks[id] ?? []);
}

export function toggleTask(id, index) {
  const set = taskSet(id);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  state.tasks[id] = [...set].sort((a, b) => a - b);
  emit();
}

export function setNote(id, text) {
  if (text.trim()) state.notes[id] = text;
  else delete state.notes[id];
  save();
}

export function getNote(id) {
  return state.notes[id] ?? '';
}

/* ------------------------------------------------------------------ cards */

export function addCards(cards) {
  let added = 0;
  const now = Date.now();
  for (const card of cards) {
    if (state.cards[card.id]) continue;
    state.cards[card.id] = {
      ...card,
      due: now,
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: now,
    };
    added += 1;
  }
  if (added) emit();
  return added;
}

export function dueCards(now = Date.now()) {
  return Object.values(state.cards)
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function cardCounts() {
  const cards = Object.values(state.cards);
  return {
    total: cards.length,
    due: cards.filter((c) => c.due <= Date.now()).length,
    learned: cards.filter((c) => c.reps > 0).length,
  };
}

export function updateCard(id, patch) {
  if (!state.cards[id]) return;
  state.cards[id] = { ...state.cards[id], ...patch };
  emit();
}

/* ---------------------------------------------------------------- settings */

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0d1a' : '#fafaf5');
  emit();
}

export function reset() {
  const theme = state.theme;
  state = EMPTY();
  state.theme = theme;
  emit();
}

/* --------------------------------------------------------------- selectors */

export function completedCount() {
  return Object.values(state.lessons).filter((l) => l.done).length;
}

export function phaseProgress(phase) {
  let done = 0;
  let started = 0;
  for (const lesson of phase.lessons) {
    const s = state.lessons[lesson.id];
    if (!s) continue;
    started += 1;
    if (s.done) done += 1;
  }
  return { done, started, total: phase.lessons.length };
}

export function weeklyXp(days = 7) {
  const out = [];
  let cursor = dayKey();
  for (let i = 0; i < days; i += 1) {
    out.unshift({ day: cursor, xp: state.days[cursor] || 0 });
    cursor = shiftDay(cursor, -1);
  }
  return out;
}

export function xpByPhase() {
  const map = {};
  for (const lesson of Object.values(state.lessons)) {
    map[lesson.phaseId ?? ''] = (map[lesson.phaseId ?? ''] || 0) + (lesson.earned ?? 0);
  }
  return map;
}

export function recentLessons(limit = 5) {
  return Object.entries(state.lessons)
    .filter(([, s]) => s.completedAt)
    .sort((a, b) => (a[1].completedAt < b[1].completedAt ? 1 : -1))
    .slice(0, limit)
    .map(([id, s]) => ({ id, ...s }));
}
