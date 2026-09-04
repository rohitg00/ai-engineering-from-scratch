export type FileStatus =
  | "queued"
  | "rewriting"
  | "building"
  | "passed"
  | "failed";

export type Recipe = "openrewrite" | "libcst" | "agent";

export type FileDiff = {
  path: string;
  status: FileStatus;
  recipe: Recipe;
  linesAdded: number;
  linesRemoved: number;
  testsTouched: number;
  lastError?: string;
};

export type MigrationState = "running" | "passed" | "failed" | "queued";

export type Migration = {
  id: string;
  repo: string;
  sourceRuntime: string;
  targetRuntime: string;
  startedAt: number;
  budgetUsd: number;
  spentUsd: number;
  turns: number;
  maxTurns: number;
  files: FileDiff[];
  state: MigrationState;
};

export type RolledUpStats = {
  total: number;
  running: number;
  passed: number;
  failed: number;
  spentUsd: number;
};
