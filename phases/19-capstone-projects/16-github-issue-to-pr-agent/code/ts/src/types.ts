export type AuditEntry = {
  ts: number;
  event: string;
  action: string;
  repo: string;
  issue?: number;
  note: string;
};

export type IssuePayload = {
  action: string;
  issue?: { number: number; title: string; user?: { login: string } };
  repository?: { full_name: string };
};

export type PingPayload = { zen?: string; hook_id?: number };

export type RouteResult = { code: number; body: unknown };
