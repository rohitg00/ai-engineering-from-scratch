---
id: autonomous-agents
title: Autonomous Agents and Permissions
code: AA
subtitle: Run an agent unattended with limits. Permission modes, budgets, kill switches, durable execution, approvals, rollback.
hue: 330
sources: phases/15-autonomous-systems/01-long-horizon-agents, phases/15-autonomous-systems/08-bounded-self-improvement, phases/15-autonomous-systems/10-claude-code-permission-modes, phases/15-autonomous-systems/12-durable-execution, phases/15-autonomous-systems/13-cost-governors, phases/15-autonomous-systems/14-kill-switches-canaries, phases/15-autonomous-systems/15-propose-then-commit, phases/15-autonomous-systems/16-checkpoints-rollback
source_hash: 103b764609d13d4e
---

## Operator tasks
type: task-table
from: phases/15-autonomous-systems/10-claude-code-permission-modes/docs/en.md, phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/code/main.py, phases/15-autonomous-systems/12-durable-execution/code/main.py, phases/15-autonomous-systems/15-propose-then-commit/code/main.py

| Task | Code |
|---|---|
| Review a plan first | permission mode `plan` |
| Auto-approve file edits only | permission mode `acceptEdits` |
| Cap spend and loop turns | `max_budget_usd`, `max_turns` |
| Limit the tool set | `allowed_tools` / `disallowed_tools` |
| Kill the agent container | `kubectl delete pod` |
| Trip on repeated calls | `CircuitBreaker(threshold=5)` |
| Replay after a crash | `workflow(EventLog(<path>), <query>)` |
| Make an approval retry-safe | `k = p.key()` |

## Control layers
type: architecture
from: phases/15-autonomous-systems/10-claude-code-permission-modes/docs/en.md, phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md, phases/15-autonomous-systems/15-propose-then-commit/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md

```arch
node | loop | 1,1 | Agent loop | turns, tool calls
node | perm | 2,1 | Permission mode | plan to bypassPermissions
node | gov | 3,1 | Cost governor | stack of caps
node | kill | 4,1 | Kill switch | agent cannot write it
node | breaker | 1,2 | Circuit breaker | closed, open, half-open
node | canary | 2,2 | Canary token | access is the alarm
node | prop | 3,2 | Proposal store | propose, commit, verify
node | log | 4,2 | Event log | keyed by thread_id
edge | loop | perm | action
edge | perm | gov | spend
edge | gov | kill | breach
edge | loop | breaker | calls
edge | loop | canary | reads
edge | perm | prop | approve
edge | prop | log | persist
```

## Propose, commit, verify
type: flow
from: phases/15-autonomous-systems/15-propose-then-commit/docs/en.md, phases/15-autonomous-systems/15-propose-then-commit/code/main.py, phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md, phases/15-autonomous-systems/16-checkpoints-rollback/code/main.py

1. **Propose**: Store intent, lineage, blast radius, rollback. Status `waiting`.
2. **Surface**: A person reviews the metadata, not the agent.
3. **Approve**: `checklist_approve` needs all three checks. Status `approved`.
4. **Precondition**: State still matches the approval. Else `aborted-precondition`.
5. **Commit**: Persist the intent first, then run the side effect.
6. **Verify**: Re-read the target. A failure runs the rollback.
7. **Retry**: A terminal status returns the stored result. No second run.

## Durable activity
type: annotated-code
lang: python
from: phases/15-autonomous-systems/12-durable-execution/code/main.py

```python
def activity(name: str):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(log: EventLog, *args):
            hit = log.lookup(name, args)  # done event in log?
            if hit:
                return hit["result"]  # replay, no re-run
            log.append({"name": name, "args": list(args), "status": "started"})
            result = fn(*args)  # the real side effect
            log.append({"name": name, "args": list(args),
                        "status": "done", "result": result})  # log output
            return result
        return wrapper
    return deco
```

## Governor and breaker
type: annotated-code
lang: python
from: phases/15-autonomous-systems/13-cost-governors/code/main.py, phases/15-autonomous-systems/14-kill-switches-canaries/code/main.py

```python
gov = Governor(max_turns=200, max_budget_usd=50.0)  # session caps
if gov.enable_iter_cap and turn >= gov.max_turns:
    run.stopped_by = "max_turns"  # iteration cap
if gov.enable_session_cap and run.dollars >= gov.max_budget_usd:
    run.stopped_by = "max_budget_usd"  # dollar cap
if gov.enable_velocity and velocity_exceeded(run, gov, now_min):
    run.stopped_by = "velocity_limit"  # rolling spend rate
if kill_switch["enabled"]:
    break  # external off-button
allowed = breaker.record(f"{a.kind}:{a.payload}")
if not allowed:
    break  # 5 identical calls opened it
```

## Permission modes
type: concepts
from: phases/15-autonomous-systems/10-claude-code-permission-modes/docs/en.md

- **`plan`**: User approves the plan. Each action is reviewed first.
- **`default`**: "Manual". Prompts for shell, destructive and network actions.
- **`acceptEdits`**: File writes auto-approve. Shell and network still prompt.
- **`auto`**: A classifier model reviews each action. Blocks escalation.
- **`dontAsk`**: Never prompts. Unapproved actions are denied.
- **`bypassPermissions`**: Approves everything. Throwaway containers only.

## Defaults in the simulators
type: defaults
from: phases/15-autonomous-systems/13-cost-governors/code/main.py, phases/15-autonomous-systems/14-kill-switches-canaries/code/main.py, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `max_tokens_per_request` | 10_000 | Per-call completion cap |
| `max_turns` | 200 | Loop iterations per session |
| `max_budget_usd` | 50.0 | Session dollars, aborts on breach |
| `velocity_usd_per_min` | 5.0 | Rolling spend rate cut-off |
| `velocity_window_min` | 10.0 | Window for the rate |
| `monthly_cap_usd` | 500.0 | Catches slow leaks late |
| `threshold` | 5 | Identical calls that open the breaker |
| Half-open probes | default 1 | 1 to 3 after the cool-down |

## Which cap catches what
type: concepts
from: phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md

- **Runaway loop**: Caught by the velocity limit.
- **Slow leak**: About 2x expected work. Caught by the daily cap.
- **Bad release**: New version uses 5x tokens. Caught by weekly or monthly cap.
- **Legitimate surge**: Caught by the hour or day cap with a clear log.
- **Slow adversarial drift**: Beats statistical detectors. Hard limits catch it.
- **Composed safe actions**: No detector catches them.

## Troubleshooting
type: troubleshooting
from: phases/15-autonomous-systems/12-durable-execution/docs/en.md, phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md, phases/15-autonomous-systems/15-propose-then-commit/docs/en.md, phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Crash re-runs all tool calls | Naive `while True` loop | Activities plus an event log |
| Replay diverges | Wall clock or random in workflow | Register it as a side effect |
| Approved action runs twice | No idempotency key | One key per proposal |
| Overdraft after resume | Idempotency check only | Add a precondition check |
| "Committed" but no side effect | Status saved, action lost | Verify by re-read, then roll back |
| Approvals with no real review | Plain Approve button | Challenge-and-response checklist |
| Bill tripled after a new tool | No per-tool cap | Per-tool cap, daily-growth alert |
| Agent turns off its canary | Detector in the agent's reach | Keep it where agent cannot write |

## Glossary
type: glossary
from: phases/15-autonomous-systems/01-long-horizon-agents/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md, phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/15-propose-then-commit/docs/en.md, phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md

- **HITL**: Human-in-the-loop. A person approves before the action.
- **METR horizon**: Task length a model completes at 50% reliability.
- **Denial of Wallet**: Agent loop that spends with no cap to stop it.
- **thread_id**: Key that scopes durable state for one session.
- **Lease**: Short claim that a worker runs a run. It expires on crash.
- **Blast radius**: Scope of effect if the action goes wrong.
- **SAGA**: Compensating transaction that neutralizes the original action.

## Q&A
type: qa
from: phases/15-autonomous-systems/01-long-horizon-agents/docs/en.md, phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md, phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md, phases/15-autonomous-systems/10-claude-code-permission-modes/docs/en.md

- **99% per step, 70 steps?** The agent still fails half the time.
- **Why a stack of caps?** One monthly cap fires after the wallet is gone.
- **Why persist every transition?** Replay lands anywhere and lease recovery is precise.
- **When skip durable execution?** Short runs with no human input, or read-only work.
- **What does `auto` miss?** Subtle injection and harmful sequences of safe actions.

## Tips
type: tips
from: phases/15-autonomous-systems/13-cost-governors/docs/en.md, phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md, phases/15-autonomous-systems/15-propose-then-commit/docs/en.md, phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md

- Never run `auto` without `max_budget_usd`.
- Check the kill switch on every consequential action.
- Re-enable a kill switch only by an explicit human action.
- Give every new tool its own cap and alert.
- Always HITL for irreversible writes. Never for reads.
- Rehearse each rollback end to end at least once.
