import type { AuditEntry } from "./types.js";

export class AuditLog {
  private entries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  all(): AuditEntry[] {
    return [...this.entries];
  }

  count(): number {
    return this.entries.length;
  }
}

export function dispatchAgent(
  audit: AuditLog,
  repo: string,
  issueNumber: number,
  title: string,
): string {
  const draftBranch = `agent/issue-${issueNumber}`;
  audit.log({
    ts: Date.now(),
    event: "issues.opened",
    action: "dispatched_agent",
    repo,
    issue: issueNumber,
    note: `would clone ${repo}, spin sandbox, branch=${draftBranch}, title="${title}"`,
  });
  audit.log({
    ts: Date.now(),
    event: "issues.opened",
    action: "stub_pr_created",
    repo,
    issue: issueNumber,
    note: `would open PR ${repo}#PR draft from ${draftBranch} -> main`,
  });
  return draftBranch;
}
