---
id: agent-failure-modes
title: Why Agents Fail
code: WA
subtitle: Name the failure, find it in the trace, gate it. Detectors, MAST, retry storms, PVE and a trace debugger.
hue: 0
sources: phases/14-agent-engineering/25-multi-agent-debate, phases/14-agent-engineering/26-failure-modes-agentic, phases/14-agent-engineering/27-prompt-injection-defense, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink, projects/agent-trace-debugger
source_hash: 7b1f84213ea46a0a
---

## Symptoms, causes, fixes
type: troubleshooting
span: 2
from: phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Success message on a 400 error | Success hallucination | Re-probe state. Was the file actually created? |
| One wrong call triggers four API calls | Cascading error | Automated verification gates at every step |
| Downstream load goes to 10x | Retry storm | Circuit breakers and capped retry budgets per request |
| Gradual accuracy decay, no crash | Memory poisoning | Append-only log, provenance, unwritable verifier |
| Three agents give the same wrong answer | Monoculture collapse | Use diverse prompts and/or models |
| Two agents both think they are the reviewer | Role ambiguity | Explicit role contracts and acceptance tests per task |
| Agent A thinks done, agent B still runs | State drift | Versioned shared state, state-sync checkpoints |
| Retrieved page overrides the developer prompt | Indirect prompt injection | Treat all retrieved content as untrusted. Add PVE |

## Five recurring modes and their detectors
type: command-table
from: phases/14-agent-engineering/26-failure-modes-agentic/code/main.py, phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md

| Command | What it does |
|---|---|
| `detect_hallucinated_action` | Tool name not in `KNOWN_TOOLS` |
| `detect_scope_creep` | `write_file` call with no write word in the request |
| `detect_cascading_errors` | An error, then 2 or more tool calls after it |
| `detect_context_loss` | A "do not" token appears in tool args |
| `detect_tool_misuse` | Required args missing for the tool schema |
| `detect_success_hallucination` | Success claim, write intent, state unchanged |
| `tag(trace)` | Runs all `DETECTORS`, returns the labels |
| `python3 code/main.py` | Per-trace labels and aggregate distribution |

## MAST root categories
type: concepts
from: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py, phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md

- **Source**: 1642 execution traces, 7 open-source MAS, 41-86.7% failure rate.
- **Specification Problems (41.77%)**: role ambiguity, unclear task, implicit success criteria.
- **Coordination Failures (36.94%)**: lost messages, unsynchronized shared state, state drift.
- **Verification Gaps (21.30%)**: one agent claims success and no one verifies.
- **Cost**: verification gaps are the most expensive per failure. They fail silently.
- **Code**: `categorize_incident(symptoms)` returns `spec`, `coord`, `verify` or `unknown`.

## Groupthink family
type: glossary
from: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py

- **Monoculture collapse**: same base model gives correlated errors. Signal `correlated_errors`.
- **Conformity bias**: agents align with the loudest peer. Signal `agreement_rate_spike`.
- **Deficient ToM**: agents cannot model each other. Signal `coordination_drop_long_horizon`.
- **Mixed-motive dynamics**: compromise-middle satisfies no one. Signal `compromise_outputs`.
- **Cascading reliability failures**: one error pattern triggers others. Signal `retry_amplification`.
- **STRATUS**: detection, diagnosis and validation agents. 1.5x mitigation success.

## Retry storm
type: flow
from: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md

1. **Payment service**: fails 10% of requests.
2. **Order agent**: each retry is a new order-inventory check.
3. **Inventory service**: sees 2x normal load and starts timing out.
4. **Every order**: retries. Inventory sees 10x load. Cluster goes down.
5. **Fix**: a circuit breaker short-circuits with cached or default results.

## Circuit breaker and storm simulator
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py

```python
breaker = CircuitBreaker()           # starts BreakerState.CLOSED
breaker.allow()                      # False while OPEN, inside cooldown
breaker.record(ok)                   # opens when error rate > threshold
# HALF_OPEN: one success closes, one failure opens again
service = DownstreamService()        # base_failure_rate 0.1
effective_rate = self.base_failure_rate + (self.load * 0.02)
while attempts_for_req < 4:          # retry budget per request
    ...
simulate_retry_storm(200, use_breaker=True, seed=0)
# returns total_calls, successes, short_circuits
```

## Defaults and numbers
type: defaults
span: 1
from: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `failure_threshold` | 0.5 | Error rate that opens the breaker |
| `window_size` | 20 | Recent outcomes in the error rate |
| `open_cooldown_s` | 0.5 | Time before HALF_OPEN |
| Production open threshold | 5-10% | Error rate on each outbound call |
| CI trace gate | >=5% | Lesson exercise. Fail the build when traces tag a mode |
| Audit trace sample | ~1000 | Real traces per failure-mode audit |
| Debate N, R | N=3, R=2 | Original experiments, due to cost |

## PVE: Prompt-Validator-Executor
type: architecture
from: phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/code/main.py

```arch
node | user | 1,1 | User message | source user_message | client
node | ret | 1,2 | Retrieved content | web, memory, tool output | store
node | main | 2,1 | Main model | proposes a ToolCall | model
node | val | 3,1 | Validator | allowlist + marker scan | process
node | exec | 4,1 | Executor | runs approved call | process
node | ref | 3,2 | Refusal | try a different approach |
edge | user | main | intent
edge | ret | val | scanned
edge | main | val | candidate call
edge | val | exec | allow
edge | val | ref | reject
edge | ref | main | retry
```

## Debate topologies
type: comparison
from: phases/14-agent-engineering/25-multi-agent-debate/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/code/main.py

| Factor | Full mesh | Sparse star |
|---|---|---|
| Who reads whom | Every debater reads every peer | Spokes read only the hub |
| N=5, R=3 proposals | 15 | 15 |
| N=5, R=3 critique ops | 60 | 12 |
| Failure risk | Convergence collapse | Hub failure |
| Mitigation | Required disagreement rounds | Rotate or use multiple hubs |
| Code | `full_mesh_round` | `sparse_star_round` |

## Agent Trace Debugger
type: task-table
span: 2
from: projects/agent-trace-debugger/README.md, projects/agent-trace-debugger/API.md, projects/agent-trace-debugger/solution/cli.ts

| Task | Code |
|---|---|
| Init the workspace | `python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger` |
| Grade one stage | `python3 scripts/project_test.py agent-trace-debugger --stage 1 --path learning-artifacts/agent-trace-debugger --strict` |
| Compare to a baseline | `node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json` |
| Import OTLP JSON | `node cli.ts --format otlp --input samples/otlp.json --output otlp-trace.html --json otlp-trace.json` |
| Public API | `parseTrace`, `validateTree`, `unionDuration`, `analyze`, `render` |
| Regression fields | `wall_time_delta_ms`, `token_delta`, `error_delta` |

## Trace debugger errors
type: troubleshooting
span: 1
from: projects/agent-trace-debugger/solution/main.ts, projects/agent-trace-debugger/solution/cli.ts, projects/agent-trace-debugger/stages/01-parse/docs/en.md, projects/agent-trace-debugger/README.md

| Symptom | Cause | Fix |
|---|---|---|
| `invalid JSON line <n>` | Line is not JSON | Fix line n. Blank lines count |
| `invalid span line <n>` | Bad field, `end < start` or negative tokens | Emit `ok` or `error` and finite times |
| `duplicate span id` | Two spans share an id | Make ids unique |
| `span cycle` | Ancestor chain loops | Fix the parent ids |
| `missing parent` | Parent id not in the trace | Export the parent span |
| `child outside parent` | Child interval exceeds parent | Normalize cross-machine clocks |
| `format must be jsonl or otlp` | Bad `--format` value | Use `jsonl` or `otlp` |

## Questions
type: qa
from: phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, projects/agent-trace-debugger/project.json, projects/agent-trace-debugger/README.md

- **Why is tagging only crashes not enough?** Most agent failures produce valid-looking output.
- **Why not guardrails at the end only?** The model already touched the world.
- **Which slow-failure proxies help?** Agreement rate, retry rate, output-length distribution.
- **Why subtract the union of child intervals?** Parallel children overlap. Their sum overcounts.
- **Why compare tokens and errors, not only wall time?** The sample keeps 100 ms while tokens rise by 200.
