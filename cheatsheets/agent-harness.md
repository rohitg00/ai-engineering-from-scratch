---
id: agent-harness
title: Agent Harness Engineering
code: AH
subtitle: The code around the model. Loop contract, hooks, budgets, tools, gates, sandbox, traces and workbench files.
hue: 248
sources: phases/14-agent-engineering/01-the-agent-loop, phases/14-agent-engineering/31-agent-workbench-why-models-fail, phases/14-agent-engineering/32-minimal-agent-workbench, phases/14-agent-engineering/33-instructions-as-executable-constraints, phases/14-agent-engineering/36-scope-contracts, phases/14-agent-engineering/37-runtime-feedback-loops, phases/14-agent-engineering/38-verification-gates, phases/14-agent-engineering/40-multi-session-handoff, phases/14-agent-engineering/42-agent-workbench-capstone, phases/15-autonomous-systems/10-claude-code-permission-modes, phases/19-capstone-projects/20-agent-harness-loop-contract, phases/19-capstone-projects/21-tool-registry-schema-validation, phases/19-capstone-projects/23-function-call-dispatcher, phases/19-capstone-projects/25-verification-gates-observation-budget, phases/19-capstone-projects/26-sandbox-runner-denylist, phases/19-capstone-projects/27-eval-harness-fixture-tasks, phases/19-capstone-projects/28-observability-otel-traces, phases/19-capstone-projects/29-end-to-end-coding-task-demo
source_hash: 47bbeb6e730c72a6
---

## Harness architecture
type: architecture
from: phases/19-capstone-projects/20-agent-harness-loop-contract/docs/en.md, phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py, phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md, phases/19-capstone-projects/25-verification-gates-observation-budget/docs/en.md, phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md, phases/19-capstone-projects/28-observability-otel-traces/docs/en.md

```arch
node | caller | 1,1 | Caller | run, resume | client
node | loop | 2,1 | HarnessLoop | 6 states | process
node | hooks | 3,1 | HookRegistry | 10 topics | queue
node | budget | 4,1 | Budget | turns, tool_calls | store
node | policy | 1,2 | Planner | plan steps | model
node | gates | 2,2 | GateChain | first deny wins | process
node | tools | 3,2 | Dispatcher + Sandbox | registry, retry, jail | process
node | trace | 4,2 | Events + spans | traces.jsonl | store
edge | caller | loop | run
edge | loop | hooks | fire
edge | hooks | budget |
edge | loop | policy | plan
edge | loop | gates | tool call
edge | gates | tools | ALLOW
edge | tools | trace | span
```

## One step of the loop
type: flow
from: phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py, phases/19-capstone-projects/20-agent-harness-loop-contract/docs/en.md

1. **IDLE**: `run(goal)` emits `session.start`. This is the only legal entry.
2. **PLANNING**: The planner drafts steps. The loop emits `plan.draft` and `plan.commit`.
3. **Budget check**: Each step calls `_check_budget()`. A hit pauses to IDLE.
4. **EXECUTING**: The loop fires `before_step`. A step without a tool goes to REFLECTING.
5. **Tool step**: The loop emits `tool.call` and returns a `PullRequest` to the caller.
6. **AWAITING_TOOL**: The caller runs the tool and calls `resume(payload)`.
7. **REFLECTING**: Next step, or DONE with `goal_met` after the last step.

## Core loop: HarnessLoop._step
type: annotated-code
lang: python
from: phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py

```python
def _step(self) -> PullRequest | SessionResult:
    budget_hit = self._check_budget()        # on every step
    if budget_hit is not None:
        return budget_hit                    # pause, back to IDLE
    if self.state == State.REFLECTING:
        self._cursor += 1                    # turns += 1 also
        if self._cursor >= len(self._plan):
            return self._complete("goal_met")
    step = self._plan[self._cursor]
    if step.requires_tool:
        self.hooks.fire("before_tool_call", {"step": step})
        self.budget.tool_calls += 1          # count before yield
        self._transition(State.AWAITING_TOOL)
        return PullRequest(reason="tool_call", ...)  # pull point
```

## Drive the loop
type: task-table
from: phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py

| Task | Code |
|---|---|
| Start a session | `out = loop.run("<goal>")` |
| Subscribe to a hook | `loop.hooks.on("<topic>", <fn>)` |
| Block a tool call | `raise HookAbort("<reason>")` |
| Return a tool result | `loop.resume({"result": <value>})` |
| Resume after a budget pause | `loop.resume()` |
| Set the budget | `Budget(max_turns=<n>, max_tool_calls=<n>)` |

## Tools, gates and traces
type: task-table
from: phases/19-capstone-projects/21-tool-registry-schema-validation/code/main.py, phases/19-capstone-projects/23-function-call-dispatcher/code/main.py, phases/19-capstone-projects/25-verification-gates-observation-budget/code/main.py, phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, phases/19-capstone-projects/28-observability-otel-traces/code/main.py

| Task | Code |
|---|---|
| Register a tool | `registry.register(<name>, <schema>, <fn>)` |
| Replace a tool | `registry.register(..., override=True)` |
| Dispatch a call | `await disp.dispatch("<name>", <args>)` |
| Collapse duplicate calls | `disp.dispatch(..., idempotency_key="<key>")` |
| Gate a call | `chain.evaluate(<call>, <ctx>)` |
| Run in the sandbox | `sandbox.run([<exe>, "<arg>"])` |
| Span a tool call | `builder.span("gen_ai.tool.execution")` |

## Gate chain, then sandbox
type: annotated-code
lang: python
from: phases/19-capstone-projects/25-verification-gates-observation-budget/code/main.py, phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py

```python
chain = GateChain(gates=(
    WhitelistGate(allowed=frozenset({"read_file"})),  # allow-set
    RegexGate.from_strings(patterns=(r"\bsudo\b",)),  # argv pattern
    RecencyGate(window=3),                  # stale observation
    BudgetGate(max_tokens=200),             # ledger total
))
outcome = chain.evaluate(call, ctx)         # stops at first deny
if not outcome.allow:
    refused += 1                            # see outcome.deny_reason
ledger.record(obs)                          # BudgetGate reads it
config = SandboxConfig(project_root=root)
result = Sandbox(config=config).run(["rm", "-rf", "."])
result.denied                               # True: rm on denylist
```

## Workbench scripts
type: command-table
from: phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/bin/install.sh, phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/scripts/init_agent.py, phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/scripts/run_with_feedback.py, phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/scripts/verify_agent.py, phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/scripts/generate_handoff.py, phases/14-agent-engineering/42-agent-workbench-capstone/docs/en.md

| Command | What it does |
|---|---|
| `bin/install.sh` | Copies the pack into the repo. |
| `bin/install.sh --force` | Overwrites an existing `AGENTS.md`. |
| `python3 scripts/init_agent.py` | Probes runtime, deps, env, state age. |
| `python3 scripts/run_with_feedback.py <cmd>` | Logs one record to `feedback_record.jsonl`. |
| `python3 scripts/verify_agent.py <task_id>` | Gate verdict. Exits 1 on a block. |
| `python3 scripts/generate_handoff.py <task_id>` | Writes `handoff.json` and `handoff.md`. |

## The seven workbench surfaces
type: concepts
from: phases/14-agent-engineering/31-agent-workbench-why-models-fail/docs/en.md

- **Instructions**: Startup rules, forbidden actions, definition of done.
- **State**: Current task, touched files, blockers, next action.
- **Scope**: Allowed files, forbidden files, acceptance criteria.
- **Feedback**: Real command output captured into the loop.
- **Verification**: Tests, lint, smoke run, scope check.
- **Review**: A second pass with a different role.
- **Handoff**: What changed, why, what is left.

## Defaults
type: defaults
from: phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py, phases/19-capstone-projects/21-tool-registry-schema-validation/code/main.py, phases/19-capstone-projects/23-function-call-dispatcher/code/main.py, phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, phases/19-capstone-projects/29-end-to-end-coding-task-demo/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_turns` | 8 | Budget. Turns before a pause |
| `max_tool_calls` | 16 | Budget. Tool calls per session |
| `max_wall_seconds` | 30.0 | Budget. Wall clock seconds |
| `timeout_ms` | 30_000 | Per tool. Per-call override wins |
| `max_attempts` | 3 | Dispatcher. Timeout and transient only |
| `concurrency` | 8 | Dispatcher fan-out semaphore |
| `DEFAULT_MAX_OUTPUT_BYTES` | 64 * 1024 | Sandbox cap per stream |
| `observation_budget` | 4000 | Tokens. End-to-end run, lesson 29 |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.py, phases/19-capstone-projects/21-tool-registry-schema-validation/code/main.py, phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md, phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/scripts/verify_agent.py

| Symptom | Cause | Fix |
|---|---|---|
| `illegal transition` | Edge not in the legal map | Change state only in `_transition` |
| `requires a payload` | `resume()` at a tool pull point | Pass a result or an error |
| `budget_exceeded:turns` | A budget limit was reached | Inspect, then `resume()` |
| `kind="schema"` never retries | Schema errors are deterministic | Fix the arguments |
| A write runs twice | Retry raced an in-flight call | Pass `idempotency_key` |
| `feedback.null_exit` block | No exit code was captured | Rerun. Do not advance |

## Glossary
type: glossary
from: phases/14-agent-engineering/01-the-agent-loop/docs/en.md, phases/14-agent-engineering/01-the-agent-loop/outputs/skill-agent-loop.md, phases/19-capstone-projects/23-function-call-dispatcher/code/main.py, phases/19-capstone-projects/27-eval-harness-fixture-tasks/docs/en.md, phases/19-capstone-projects/28-observability-otel-traces/docs/en.md, phases/15-autonomous-systems/10-claude-code-permission-modes/code/main.py

- **ReAct**: Reason + Act. Thought, Action, Observation in one stream.
- **OTel**: OpenTelemetry. GenAI conventions fix the `gen_ai.*` keys.
- **JSON-RPC**: Error codes -32601, -32602, -32603.
- **pass@k**: `1 - (1 - p)^k` over k samples.
- **HITL**: Human in the loop. Low-confidence actions go here.

## Questions and answers
type: qa
from: phases/19-capstone-projects/20-agent-harness-loop-contract/docs/en.md, phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md, phases/19-capstone-projects/25-verification-gates-observation-budget/docs/en.md, phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md, phases/14-agent-engineering/38-verification-gates/docs/en.md

- **Why is the budget a yield?** The caller decides to extend and resume, or to close.
- **Why no retry on a non-idempotent timeout?** The write possibly committed. A retry duplicates it.
- **Why cheap gates first?** A deny stops the chain before the expensive checks.
- **Why no LLM judge in the gate?** Same artifacts must give the same verdict.

## Tips
type: tips
from: phases/19-capstone-projects/20-agent-harness-loop-contract/docs/en.md, phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md, phases/14-agent-engineering/01-the-agent-loop/docs/en.md, phases/14-agent-engineering/33-instructions-as-executable-constraints/docs/en.md, phases/14-agent-engineering/36-scope-contracts/docs/en.md

- Change state in one function only. The invariants then live in one place.
- Derive the key in the planner: `f"{step_id}:{tool_name}:{hash(args)}"`.
- Return tool errors as observation strings, not crashes.
- Hooks mutate or abort. Events only record.
- Keep `AGENTS.md` under 50 lines. Load topic docs on demand.
- Put `forbidden_files` in every scope contract.
