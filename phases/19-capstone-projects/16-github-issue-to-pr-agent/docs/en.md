# Capstone 16 — GitHub Issue-to-PR Autonomous Agent

> AWS Remote SWE Agents, Cursor Background Agents, OpenAI Codex cloud, and Google Jules all ship the same 2026 product shape: label an issue, get a PR. Run an agent in a cloud sandbox, verify tests pass, and post a review-ready PR with rationale. The hard parts are reproducing the repo's build environment automatically, preventing credential leakage, enforcing per-repo budgets, and making sure the agent cannot force-push. This capstone builds the self-hosted version and compares it on cost and pass rate to the hosted alternatives.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:** P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problem

The async cloud coding agent is a separate product category from interactive coding agents (capstone 01). The UX is a GitHub label. You label an issue `@agent fix this`, a worker spins up in a cloud sandbox, clones the repo, runs tests, edits files, verifies, and opens a PR with the agent's rationale in the body. No interactive loop, no terminal. AWS Remote SWE Agents, Cursor Background Agents, OpenAI Codex cloud, Google Jules, and Factory Droids all converge on this.

The engineering challenges are concrete: environment reproduction (the agent has to build the repo from scratch without a cached dev image), flaky tests (must be re-run or isolated), credential scoping (a GitHub App with minimal fine-grained permissions), budget enforcement per repo per day, and no-force-push policy. The capstone measures pass rate, cost, and safety vs the hosted alternatives.

## Concept

The trigger is a GitHub webhook (issue label or PR comment). A dispatcher enqueues work to ECS Fargate or Lambda. The worker pulls the repo into a Daytona or E2B sandbox with a generic Dockerfile inferred from the repo (language, framework). The agent runs a mini-swe-agent or SWE-agent v2 loop against Claude Opus 4.7 or GPT-5.4-Codex. It iterates: read code, propose fix, apply patch, run tests.

Verification is the gating step. Full CI must pass in the sandbox before the PR opens. Coverage delta is computed; if negative beyond a threshold, the PR opens but gets labeled `needs-review`. The agent posts the rationale as the PR description plus an `@agent` thread the reviewer can ping for follow-ups.

Safety is scoped through two different GitHub surfaces: the App provides a short-lived installation token with `workflows: read` and narrow repo contents/PR scopes; branch protection (not app permissions) enforces "no direct writes to `main`" and "no force-push" — the app is never added to the bypass list. Path-scoped read-only access to `.github/workflows` is not a real GitHub App primitive, so the agent's allow-list on file edits has to enforce that at the worker. Budget ceilings per repo per day are enforced at the dispatcher (e.g., max 5 PRs per repo per day, $20 per PR).

## Architecture

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## Stack

- Trigger: GitHub App with fine-grained token; webhook receiver via Lambda or Fly.io
- Worker: ECS Fargate task (or GitHub Actions self-hosted runner)
- Sandbox: Daytona devcontainer or E2B sandbox per task
- Agent loop: mini-swe-agent baseline or SWE-agent v2 over Claude Opus 4.7 / GPT-5.4-Codex
- Retrieval: tree-sitter repo-map + ripgrep
- Verification: full CI in-sandbox + coverage delta gate
- Observability: Langfuse with per-PR trace archive linked from the PR body
- Budget: per-repo daily dollar ceiling; max PRs per repo per day

## Build It

1. **GitHub App.** Fine-grained installation token: issues read+write, pull_requests write, contents read+write, workflows read. Branch protection (the only surface that can do this) enforces "no direct push to `main`" and "no force-push"; the app is not in the bypass list. The worker enforces "no writes under `.github/workflows`" as an allow-list check on the proposed diff, since GitHub App permissions are not path-scoped.

2. **Webhook receiver.** Lambda function accepts issue label / PR comment webhooks. Filters by label `@agent fix this`. Enqueues to SQS.

3. **Dispatcher.** Pops tasks from SQS. Enforces per-repo per-day budget. Spins up an ECS Fargate task with the repo URL, issue body, and a fresh Daytona sandbox.

4. **Environment inference.** Detect language (Python, Node, Go, Rust) and package manager (uv, pnpm, go mod, cargo). Generate a Dockerfile on the fly if one does not exist.

5. **Agent loop.** mini-swe-agent or SWE-agent v2 with Claude Opus 4.7. Tools: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git. Hard limits: $20 cost, 30 min wall-clock, 30 agent turns.

6. **Verification.** After the loop concludes, run the full test suite in-sandbox. Compute coverage delta via jacoco / coverage.py. If CI red: halt, do not open PR. If coverage drops more than 2%: open PR with `needs-review` label.

7. **PR posting.** Push the agent branch. Open PR via GitHub API with: title, rationale, diff summary, trace URL, cost, turns.

8. **Credential hygiene.** Worker runs with a short-lived GitHub App installation token. Logs are scrubbed for secrets before archival.

9. **Eval.** 30 seeded internal issues of varying difficulty. Measure pass rate, PR quality (diff size, style, coverage), cost, latency. Compare with Cursor Background Agents and AWS Remote SWE Agents on the same issues.

## Use It

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Ship It

`outputs/skill-issue-to-pr.md` is the deliverable. A GitHub App + async cloud worker that turns labeled issues into review-ready PRs with bounded cost and scoped credentials.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Exercises

1. Add a "fix flaky test" mode: the label `@agent stabilize-flake TestX` runs the test 50 times in-sandbox and proposes a minimal change that stabilizes it.

2. Compare cost vs Cursor Background Agents on three shared issues. Report which tools win where.

3. Implement a budget dashboard: per-repo per-day cost, per-user cost. Alert on anomaly.

4. Build a "dry-run" mode that opens a draft PR without running CI, so reviewers can examine the plan cheap.

5. Add a retention policy: PR branches older than 7 days without merge get deleted automatically.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Further Reading

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — the canonical async cloud agent reference
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI reference
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — commercial alternative
- [OpenAI Codex (cloud)](https://openai.com/codex) — hosted competitor
- [Google Jules](https://jules.google) — Google's hosted version
- [Factory Droids](https://www.factory.ai) — alternate commercial reference
- [GitHub App documentation](https://docs.github.com/en/apps) — scoped bot identity
- [Daytona cloud sandboxes](https://daytona.io) — reference sandbox
