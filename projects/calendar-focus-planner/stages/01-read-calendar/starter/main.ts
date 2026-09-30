export type Event = { id: string; title: string; start: number; end: number };
export type Task = { id: string; title: string; minutes: number; priority: number };
export type Slot = { start: number; end: number };
export type Plan = { schemaVersion: number; window: Slot; busy: Slot[]; scheduled: (Task & Slot)[]; unscheduled: (Task & { reason: string })[] };

export function parseCalendar(text: string): Event[] { throw new Error("Stage 1: implement parseCalendar"); }
export function availableSlots(events: Event[], window: Slot, bufferMinutes = 0): { busy: Slot[]; free: Slot[] } { throw new Error("Stage 2: implement availableSlots"); }
export function schedule(tasks: Task[], events: Event[], window: Slot, bufferMinutes = 0): Plan { throw new Error("Stage 3: implement schedule"); }
export function exportCalendar(plan: Plan, createdAt: number): string { throw new Error("Stage 4: implement exportCalendar"); }
export function renderPlan(plan: Plan): string { throw new Error("Stage 4: implement renderPlan"); }
