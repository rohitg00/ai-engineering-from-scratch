export type Lesson = { id: string; title: string; prereqs: string[] };

export type Mastery = {
  score: number;
  attempts: number;
  successes: number;
  next_due_at: number;
  interval_ms: number;
};

export type PickReason = "new_eligible" | "review_overdue";

export type Pick = { lesson: Lesson; reason: PickReason };

export const MASTERY_THRESHOLD = 0.7;
export const BASE_INTERVAL_MS = 1000 * 60 * 60 * 24;
