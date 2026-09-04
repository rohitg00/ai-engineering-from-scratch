import type { Job, StageStatus } from "./types.js";
import { STAGE_DURATIONS_MS } from "./types.js";

export function advanceJob(job: Job, nowOverride?: number): void {
  const now = nowOverride ?? Date.now();
  let elapsed = now - job.created_at;
  let priorOffset = 0;
  for (const slot of job.stages) {
    const dur = STAGE_DURATIONS_MS[slot.stage];
    if (elapsed <= 0) {
      slot.status = "pending";
      continue;
    }
    if (elapsed < dur) {
      slot.status = "running";
      slot.started_at = job.created_at + priorOffset;
      slot.detail = `${Math.round((elapsed / dur) * 100)}% through ${slot.stage}`;
      break;
    }
    slot.status = "done";
    slot.started_at = job.created_at + priorOffset;
    slot.finished_at = slot.started_at + dur;
    slot.detail = `${slot.stage} complete in ${dur}ms`;
    priorOffset += dur;
    elapsed -= dur;
  }
}

export function overallStatus(job: Job): StageStatus {
  if (job.stages.some((s) => s.status === "error")) return "error";
  if (job.stages.every((s) => s.status === "done")) return "done";
  if (job.stages.some((s) => s.status === "running")) return "running";
  return "pending";
}
