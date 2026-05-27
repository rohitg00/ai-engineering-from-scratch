import { BASE_INTERVAL_MS } from "./types.js";

export const MIN_INTERVAL_MS = 60_000;
export const MAX_INTERVAL_MS = BASE_INTERVAL_MS * 30;

export function scheduleNextDue(
  currentInterval: number,
  correct: boolean,
  now: number,
): { interval_ms: number; next_due_at: number } {
  const nextInterval = correct
    ? Math.min(currentInterval * 2, MAX_INTERVAL_MS)
    : Math.max(Math.floor(currentInterval / 2), MIN_INTERVAL_MS);
  return { interval_ms: nextInterval, next_due_at: now + nextInterval };
}
