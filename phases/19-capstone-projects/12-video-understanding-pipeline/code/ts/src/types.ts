export type Stage = "chunk" | "embed" | "index" | "qa";

export type StageStatus = "pending" | "running" | "done" | "error";

export type StageState = {
  stage: Stage;
  status: StageStatus;
  started_at?: number;
  finished_at?: number;
  detail?: string;
};

export type Job = {
  id: string;
  video_url: string;
  question: string;
  created_at: number;
  stages: StageState[];
};

export const STAGES: Stage[] = ["chunk", "embed", "index", "qa"];

export const STAGE_DURATIONS_MS: Record<Stage, number> = {
  chunk: 1200,
  embed: 2400,
  index: 800,
  qa: 1600,
};
