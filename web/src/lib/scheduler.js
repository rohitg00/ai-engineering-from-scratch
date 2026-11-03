/**
 * Spaced repetition, stdlib only.
 *
 * A compact SM-2 variant. Each card carries an ease factor, an interval in
 * days, and a repetition count. Four grades:
 *
 *   again  forgot it        -> 10 minutes, ease drops, lapse counted
 *   hard   slow recall      -> shorter than good, ease drops a little
 *   good   recalled         -> the normal interval
 *   easy   instant recall   -> longer than good, ease rises
 *
 * This is deliberately simpler than FSRS. It has no training data, no model
 * weights, and it behaves the same on every device.
 */

export const GRADES = [
  { id: 'again', label: 'Again', hint: 'forgot' },
  { id: 'hard', label: 'Hard', hint: 'slow' },
  { id: 'good', label: 'Good', hint: 'recalled' },
  { id: 'easy', label: 'Easy', hint: 'instant' },
];

const DAY = 86_400_000;
const TEN_MIN = 600_000;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function schedule(card, grade, now = Date.now()) {
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card;

  if (grade === 'again') {
    return {
      ease: clamp(ease - 0.2, 1.3, 3),
      interval: 0,
      reps: 0,
      lapses: lapses + 1,
      due: now + TEN_MIN,
    };
  }

  reps += 1;

  if (reps === 1) interval = grade === 'hard' ? 0.5 : grade === 'easy' ? 2 : 1;
  else if (reps === 2) interval = grade === 'hard' ? 1.5 : grade === 'easy' ? 5 : 3;
  else {
    const factor = grade === 'hard' ? 0.85 : grade === 'easy' ? 1.15 : 1;
    interval = Math.max(1, Math.round(interval * ease * factor));
  }

  ease = clamp(ease + (grade === 'hard' ? -0.15 : grade === 'easy' ? 0.1 : 0), 1.3, 3);

  return { ease, interval, reps, lapses, due: now + Math.round(interval * DAY) };
}

export function preview(card, grade, now = Date.now()) {
  const next = schedule(card, grade, now);
  const ms = next.due - now;
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  const days = ms / DAY;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}

export function dueLabel(due, now = Date.now()) {
  const ms = due - now;
  if (ms <= 0) return 'due now';
  if (ms < 3_600_000) return `in ${Math.round(ms / 60_000)} min`;
  if (ms < DAY) return `in ${Math.round(ms / 3_600_000)} h`;
  return `in ${Math.round(ms / DAY)} d`;
}
