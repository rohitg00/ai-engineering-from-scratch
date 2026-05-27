export type Role = "planner" | "coder" | "reviewer";

export type Message = {
  from: Role | "user";
  to: Role | "broadcast";
  topic: string;
  body: string;
  ts: number;
};

export type WorkspaceFile = {
  path: string;
  contents: string;
  lastWriter?: Role;
  revisions: number;
};

export type RunResult = { approved: boolean; turns: number };

export type LaunchArgs = {
  branch: string;
  command: string;
  argv: string[];
};

export type LaunchResult = {
  stdout: string;
  stderr: string;
  refused?: string;
};
