# Evidence: cheatsheets/agent-failure-modes.md

Abbreviations: A = phases/14-agent-engineering/25-multi-agent-debate, B = phases/14-agent-engineering/26-failure-modes-agentic, C = phases/14-agent-engineering/27-prompt-injection-defense, D = phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink, P = projects/agent-trace-debugger. d = docs/en.md, c = code/main.py.

## Symptoms, causes, fixes (troubleshooting, 8)
- Success message on a 400, success hallucination, re-probe state (was the file actually created?): B/d:59, 68, 122
- Phantom call triggers four API calls, cascading error, automated verification gates at every step: B/d:55, 63
- 10x load, retry storm, circuit breakers plus capped retry budgets per request: D/d:86, 91
- Gradual accuracy decay, memory poisoning, append-only log, provenance, unwritable verifier: D/d:99, 101
- Same wrong answer, monoculture collapse: D/d:59. Diverse prompts and/or models: A/d:66
- Two agents both reviewer, role ambiguity, role contracts and acceptance tests per task: D/d:22, 27-28
- Agent A thinks done while B executes, state drift, versioned shared state and state-sync checkpoints: D/d:36, 39, 41
- Retrieved content overrides developer prompt, treat all retrieved content as untrusted, PVE: C/d:30, 44, 55

## Five recurring modes and their detectors (command-table, 8)
- detect_hallucinated_action, KNOWN_TOOLS: B/c:34, 37-41
- detect_scope_creep, write_file with no write word: B/c:44-52
- detect_cascading_errors, error then downstream_ops >= 2: B/c:55-66
- detect_context_loss, "do not" token in args: B/c:69-77
- detect_tool_misuse, required args subset of schema: B/c:80-95
- detect_success_hallucination, write intent, success claim, state unchanged: B/c:98-105
- tag(trace) over DETECTORS: B/c:108-119
- python3 code/main.py, per-trace labels and aggregate distribution: B/d:90-94

## MAST root categories (concepts, 6)
- 1642 traces, 7 open-source MAS, 41-86.7% failure rate: D/d:3
- Specification Problems 41.77%, role ambiguity, underspecified task, implicit success criteria: D/d:20-24
- Coordination Failures 36.94%, unsynchronized shared state, lost message, state drift: D/d:31-36
- Verification Gaps 21.30%, one agent claims success, no one verifies: D/d:43-46
- Verification gaps most expensive per failure, silent: D/d:127
- categorize_incident returns spec, coord, verify, unknown: D/c:31-38

## Groupthink family (glossary, 6)
- Monoculture collapse, correlated_errors: D/d:59, D/c:43-44
- Conformity bias, loudest peer, agreement_rate_spike: D/d:61, D/c:24, 45-46
- Deficient ToM, coordination_drop_long_horizon: D/d:63, D/c:47-48
- Mixed-motive dynamics, compromise-middle, compromise_outputs: D/d:65, D/c:49-50
- Cascading reliability failures, retry_amplification: D/d:67, D/c:51-52
- STRATUS detection, diagnosis, validation, 1.5x: D/d:105-109

## Retry storm (flow, 5)
1. Payment service fails 10%: D/d:74
2. Each retry is a new order-inventory check: D/d:76-78
3. Inventory 2x load, timing out: D/d:80-82
4. Every order retries, 10x load, cluster down: D/d:84-88
5. Circuit breaker short-circuits with cached or default results: D/d:91

## Circuit breaker and storm simulator (annotated-code, 11 lines)
- CircuitBreaker starts BreakerState.CLOSED: D/c:64-69
- allow() returns False while OPEN inside cooldown: D/c:79-85
- record(ok) opens when error rate > failure_threshold: D/c:87-98
- HALF_OPEN success closes, failure opens: D/c:89-94
- DownstreamService base_failure_rate 0.1: D/c:104-105
- effective_rate formula: D/c:110
- attempts_for_req < 4: D/c:125
- simulate_retry_storm(200, use_breaker=True, seed=0): D/c:168
- returns total_calls, successes, short_circuits: D/c:115, 138

## Defaults and numbers (defaults, 7)
- failure_threshold 0.5: D/c:66
- window_size 20: D/c:67
- open_cooldown_s 0.5, then HALF_OPEN: D/c:68, 81-82
- Production open threshold 5-10%: D/d:173
- CI gate >=5% of traces: B/d:112
- ~1000 traces per audit: D/d:117
- Debate N=3, R=2 due to cost: A/d:30

## PVE: Prompt-Validator-Executor (architecture, 6 nodes, 6 edges)
- User message, source user_message: C/c:63, 127
- Retrieved content web, memory: C/d:29, C/c:144, 154
- Main model proposes ToolCall: C/d:55, C/c:41-45
- Validator allowlist + marker scan: C/c:53-71
- Executor runs approved call: C/d:77, C/c:74-82
- Refusal, "try a different approach": C/d:57

## Debate topologies (comparison, 6)
- Full mesh every peer, star spokes read only the hub: A/d:112-114
- N=5, R=3 proposals, 15 for both: A/d:40-41
- N=5, R=3 critique ops, 60 full mesh vs 12 star: A/d:40-41
- Convergence collapse vs hub failure: A/d:64-65
- Required disagreement rounds, rotate or use multiple hubs: A/d:64-65
- full_mesh_round, sparse_star_round: A/c:32, 43

## Agent Trace Debugger (task-table, 6)
- --init: P/README.md:12
- --stage 1 --strict: P/README.md:13
- node cli.ts --input ... --baseline ... --json trace.json: P/README.md:21, 33
- --format otlp: P/README.md:66
- parseTrace, validateTree, unionDuration, analyze, render: P/API.md:12-16
- wall_time_delta_ms, token_delta, error_delta: P/solution/cli.ts:30-34

## Trace debugger errors (troubleshooting, 7)
- invalid JSON line: P/solution/main.ts:27. Blank lines count in numbering: P/stages/01-parse/docs/en.md:13
- invalid span line, end < start, tokens < 0, ok/error status, finite times: P/solution/main.ts:29-40
- duplicate span id: P/solution/main.ts:46
- span cycle: P/solution/main.ts:51
- missing parent: P/solution/main.ts:54
- child outside parent: P/solution/main.ts:59-60. Normalize cross-machine clocks: P/README.md:46
- format must be jsonl or otlp: P/solution/cli.ts:18-19

## Questions (qa, 5)
- Tagging only crashes, valid-looking output: B/d:72
- Guardrails at the end only, model already touched the world: C/d:64
- Slow-failure proxies, agreement rate, retry rate, output-length distribution: D/d:138
- Union of child intervals, parallel children overlap: P/project.json:87
- 100 ms wall time while tokens rise by 200: P/README.md:38
