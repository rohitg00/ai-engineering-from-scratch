import type { Job, StageState } from "./types.js";
import { STAGES } from "./types.js";
import { advanceJob, overallStatus } from "./stages.js";

export class JobStore {
  private jobs = new Map<string, Job>();

  create(id: string, video_url: string, question: string, createdAt?: number): Job {
    const job: Job = {
      id,
      video_url,
      question,
      created_at: createdAt ?? Date.now(),
      stages: STAGES.map((stage): StageState => ({ stage, status: "pending" })),
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id: string): Job | undefined {
    const j = this.jobs.get(id);
    if (j) advanceJob(j);
    return j;
  }

  list(now: number = Date.now()): Job[] {
    for (const j of this.jobs.values()) advanceJob(j, now);
    return [...this.jobs.values()].sort((a, b) => b.created_at - a.created_at);
  }

  summaries(): Array<{
    id: string;
    video_url: string;
    question: string;
    created_at: number;
    overall: ReturnType<typeof overallStatus>;
  }> {
    return this.list().map((j) => ({
      id: j.id,
      video_url: j.video_url,
      question: j.question,
      created_at: j.created_at,
      overall: overallStatus(j),
    }));
  }

  detail(id: string): {
    id: string;
    video_url: string;
    question: string;
    overall: ReturnType<typeof overallStatus>;
    timeline: Array<{
      stage: StageState["stage"];
      status: StageState["status"];
      started_at: number | null;
      finished_at: number | null;
      detail: string | null;
    }>;
  } | null {
    const job = this.get(id);
    if (!job) return null;
    return {
      id: job.id,
      video_url: job.video_url,
      question: job.question,
      overall: overallStatus(job),
      timeline: job.stages.map((s) => ({
        stage: s.stage,
        status: s.status,
        started_at: s.started_at ?? null,
        finished_at: s.finished_at ?? null,
        detail: s.detail ?? null,
      })),
    };
  }
}

export function seedFixture(store: JobStore): void {
  const j1 = store.create(
    "job-001",
    "vid_001",
    "how many cars pass through the intersection",
    Date.now() - 8000,
  );
  advanceJob(j1);

  const j2 = store.create("job-002", "vid_001", "plating of the dish", Date.now() - 3500);
  advanceJob(j2);

  store.create("job-003", "vid_002", "ocean at sunset");
}
