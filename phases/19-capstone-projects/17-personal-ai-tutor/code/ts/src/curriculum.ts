import type { Lesson, Mastery, Pick } from "./types.js";
import { MASTERY_THRESHOLD } from "./types.js";

export const CURRICULUM: Lesson[] = [
  { id: "py-01", title: "変数と型", prereqs: [] },
  { id: "py-02", title: "算術演算子", prereqs: ["py-01"] },
  { id: "py-03", title: "文字列", prereqs: ["py-01"] },
  { id: "py-04", title: "if / else", prereqs: ["py-02"] },
  { id: "py-05", title: "for loop", prereqs: ["py-04"] },
  { id: "py-06", title: "list", prereqs: ["py-03", "py-05"] },
  { id: "py-07", title: "dict", prereqs: ["py-06"] },
  { id: "py-08", title: "関数", prereqs: ["py-04"] },
  { id: "py-09", title: "list comprehension", prereqs: ["py-06", "py-08"] },
];

export function buildIndex(items: Lesson[]): Record<string, Lesson> {
  return Object.fromEntries(items.map((l) => [l.id, l]));
}

export function topoOrder(items: Lesson[]): string[] {
  const known = new Set(items.map((l) => l.id));
  for (const l of items) {
    for (const p of l.prereqs) {
      if (!known.has(p)) {
        throw new Error(`lesson ${l.id} が unknown prereq ${p} を参照しています`);
      }
    }
  }
  const indeg: Record<string, number> = {};
  const out: Record<string, string[]> = {};
  for (const l of items) {
    indeg[l.id] = indeg[l.id] ?? 0;
    out[l.id] = out[l.id] ?? [];
    for (const p of l.prereqs) {
      indeg[l.id] = (indeg[l.id] ?? 0) + 1;
      out[p] = out[p] ?? [];
      out[p].push(l.id);
    }
  }
  const ready: string[] = [];
  for (const id of Object.keys(indeg)) if (indeg[id] === 0) ready.push(id);
  ready.sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const nxt of out[id] ?? []) {
      indeg[nxt] = (indeg[nxt] ?? 0) - 1;
      if (indeg[nxt] === 0) {
        ready.push(nxt);
        ready.sort();
      }
    }
  }
  if (order.length !== Object.keys(indeg).length) {
    const stuck = Object.keys(indeg)
      .filter((id) => (indeg[id] ?? 0) > 0)
      .sort();
    throw new Error(`curriculum に cycle を検出しました: ${stuck.join(", ")}`);
  }
  return order;
}

export function pickNextLesson(
  topo: string[],
  index: Record<string, Lesson>,
  mastery: Record<string, Mastery>,
  now: number,
): Pick | null {
  for (const id of topo) {
    const m = mastery[id];
    const mastered = (m?.score ?? 0) >= MASTERY_THRESHOLD;
    if (mastered) continue;
    const lesson = index[id];
    if (!lesson) continue;
    const prereqsMet = lesson.prereqs.every(
      (p) => (mastery[p]?.score ?? 0) >= MASTERY_THRESHOLD,
    );
    if (prereqsMet) return { lesson, reason: "new_eligible" };
  }
  for (const id of topo) {
    const m = mastery[id];
    if (!m) continue;
    if (m.attempts > 0 && m.next_due_at <= now && m.score < 0.95) {
      const lesson = index[id];
      if (lesson) return { lesson, reason: "review_overdue" };
    }
  }
  return null;
}
