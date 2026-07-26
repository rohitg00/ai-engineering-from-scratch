# Permission Modes for Autonomous Agents

> A permission ladder — graduated levels of autonomy from review-every-action to approve-everything — is how a harness governs what an autonomous agent may do without asking. Claude Code, this lesson's worked example, exposes six such modes: "plan" asks before every action, "default" (labeled "Manual" in the UI) asks only for risky ones, "acceptEdits" auto-approves file writes but still confirms shell execution, and "bypassPermissions" approves everything. Auto Mode — the `auto` permission mode — replaces per-action approval with a separate classifier model that reviews each action before it runs and blocks anything that escalates beyond what the request asked for. Action budgets are enforced via `max_turns` and `max_budget_usd`. Availability of `auto` depends on plan, org enablement, model, and provider — and Anthropic is explicit that the classifier is not sufficient alone.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator)
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## The Problem

An autonomous coding agent on your machine is a distinct security category. The attack surface is everything the agent can reach — file system, network, credentials, clipboard, any browser tab, any open terminal. Bruce Schneier and others have flagged this publicly: computer-use agents are not a "feature update" of chatbots, they are a new kind of tool with a new kind of risk profile.

Claude Code's permission system is Anthropic's answer. Rather than one "autonomous / not autonomous" switch, there are six modes spanning a capability ladder: plan → default → acceptEdits → … → bypassPermissions. Each mode is a different trade-off between speed and review-per-action. Auto Mode (March 2026) adds a separate classifier model that moves approval off the user's critical path: it reviews each action before it runs and blocks anything that escalates beyond the request.

The engineering question: what does this system catch, what does it miss, and which mode does a given task actually warrant?

## The Concept

### The six permission modes

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Names above match public Claude Code docs; the UI labels `default` as "Manual".)

### Auto Mode in one page

Auto Mode (launched March 24, 2026) is the first permission mode to delegate per-action approval to a model. Structure:

1. **A separate classifier model.** Reviews every proposed action before it runs, judged against the declared task and the current state of the session, and blocks anything that escalates beyond what the request called for. Blocked actions fall back to the user.
2. **Gated availability.** Whether `auto` is offered at all depends on plan, organization enablement, model, and provider.

Budget controls sit alongside the classifier:

- `max_turns` — total iterations in a session.
- `max_budget_usd` — dollar cap that aborts the session.
- action-count limits per tool (no more than N `WebFetch` calls, etc.).

### What the system catches

- Straightforward prompt injection into tool inputs where the injected instruction maps to a known-risky action shape.
- Repetitive tool loops — the classifier can see action N+1 is nearly identical to action N, five times in a row.
- Clearly out-of-scope shell commands on an otherwise file-edit-only session.

### What the system can miss

- **Subtle prompt injection** that modulates behavior without producing a single flagged action. Indirect prompt injection is not a fully patchable vulnerability (OpenAI preparedness head, 2025, on browser agents — see Lesson 11).
- **Semantic-level misbehavior.** Every individual action can look safe while the composed trajectory is harmful. The classifier judges the action; it does not re-derive the user's intent.
- **Exfiltration through legitimate channels.** Writing data to a file you own, then `git push`ing to a public repo, is a sequence of allowed actions whose composition is the problem.

### Research preview framing

Anthropic shipped Auto Mode as a research preview. The documentation is explicit that the classifier is a layer, not a solution: users are expected to combine Auto Mode with budgets, allowlists, isolated workspaces, and trajectory audits (Lessons 12–16). The preview framing also reflects the documented evaluation-vs-deployment gap (Lesson 1) — a classifier that passes offline evals can behave differently in a real session where the user's context is ambiguous.

### Where this ladder lives in your workflow

- Unfamiliar task: start in `plan`. Reading the plan is cheaper than rolling back a bad run.
- Known refactor: `acceptEdits` saves a lot of confirmation clicks.
- Unattended background run: `auto` only inside a workspace whose blast radius you have measured (no credentials, no production mounts, no egress you did not opt into).
- Ephemeral containers: `dontAsk` / `bypassPermissions` is acceptable if and only if the container and its credentials are disposable.

```figure
autonomy-oversight
```

## Use It

`code/main.py` simulates an action-review classifier as a two-stage pipeline — a teaching simplification; the real `auto` mode is backed by a separate classifier model, not a documented two-stage contract. Stage 1 is a cheap keyword rule over proposed actions; Stage 2 is a slower multi-rule reviewer. The driver feeds in a short synthetic trajectory (safe actions, a prompt-injection attempt, a repetitive loop) and shows where the classifier catches and where it misses.

## Ship It

`outputs/skill-permission-mode-picker.md` matches a task description to the right permission mode, budget caps, and required isolation.

## Exercises

1. Run `code/main.py`. Which synthetic action type is never flagged by Stage 1 but always caught by Stage 2? Which is caught by neither?

2. Extend the Stage 1 rule set to catch a specific known-bad shape (e.g., `curl $ATTACKER/exfil`). Measure the false-positive rate on the benign-action sample.

3. Read Anthropic's "How the agent loop works" doc. List every external state the agent touches by default in `default` mode. Which would you need to gate separately before running `auto` unattended?

4. Design a 24-hour unattended run budget: `max_turns`, `max_budget_usd`, per-tool caps, allowlists. Justify each number.

5. Describe one trajectory where every individual action is approved by the classifier, yet the composed behavior is misaligned. (Lesson 14 covers how kill switches and canary tokens address this.)

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Further Reading

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) — permission modes, budgets, action format.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — managed-service execution model.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) — feature surface and Auto Mode announcement.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — the reason-based layer that shapes classifier judgments.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — internal perspective on long-horizon permission design.
