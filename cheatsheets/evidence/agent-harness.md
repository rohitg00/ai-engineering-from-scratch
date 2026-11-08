# Evidence: cheatsheets/agent-harness.md

P14 = phases/14-agent-engineering, P15 = phases/15-autonomous-systems, P19 = phases/19-capstone-projects
L20 = P19/20-agent-harness-loop-contract, L21 = P19/21-tool-registry-schema-validation, L23 = P19/23-function-call-dispatcher, L25 = P19/25-verification-gates-observation-budget, L26 = P19/26-sandbox-runner-denylist, L27 = P19/27-eval-harness-fixture-tasks, L28 = P19/28-observability-otel-traces, L29 = P19/29-end-to-end-coding-task-demo, PACK = P14/42-agent-workbench-capstone/outputs/agent-workbench-pack

## Harness architecture (8 nodes)
- Caller run, resume: L20/code/main.py:214, 222; L20/docs/en.md:70
- HarnessLoop 6 states: L20/code/main.py:20-26, 152; L20/docs/en.md:29
- HookRegistry 10 topics: L20/code/main.py:29-40, 120-133; L20/docs/en.md:52
- Budget turns, tool_calls: L20/code/main.py:72-90
- Planner plan steps: L20/code/main.py:136-149
- GateChain first deny wins: L25/docs/en.md:42, 61
- Dispatcher + Sandbox (registry, retry, jail): L23/docs/en.md:23, 32-34, 41; L26/docs/en.md:57; L25/docs/en.md:91
- Events + spans traces.jsonl: L20/docs/en.md:74; L28/docs/en.md:38, 58-59
- edge loop -> gates tool call, gates -> tools ALLOW: L23/docs/en.md:23; L25/docs/en.md:35, 62
- edge tools -> trace span: L26/docs/en.md:97; L28/docs/en.md:42
- edge loop -> hooks fire, loop -> policy plan: L20/code/main.py:255-256
- edge hooks -> budget (on_budget_exceeded): L20/code/main.py:203

## One step of the loop
1. IDLE, session.start, only entry: L20/code/main.py:214-220; L20/docs/en.md:46
2. PLANNING plan.draft, plan.commit: L20/code/main.py:253-261
3. _check_budget, pause to IDLE: L20/code/main.py:198-212, 270-272
4. before_step, no-tool step to REFLECTING: L20/code/main.py:283, 304-308
5. tool.call, PullRequest: L20/code/main.py:294-303
6. resume(payload): L20/code/main.py:237-250
7. REFLECTING next step or DONE goal_met: L20/code/main.py:273-279

## Core loop: HarnessLoop._step (14 lines)
- condensed from L20/code/main.py:267-303 (keeps lines 267, 270-272, 273-277, 282, 285, 287, 294, 296, 299-300; turns += 1 at 275 noted in a comment)

## Drive the loop (6 rows)
- loop.run: L20/code/main.py:324
- loop.hooks.on: L20/code/main.py:124, 322
- raise HookAbort: L20/code/main.py:57-58, 288
- resume result: L20/code/main.py:246, 326
- resume() after budget pause: L20/code/main.py:223-236
- Budget(max_turns, max_tool_calls): L20/code/main.py:72-74

## Tools, gates and traces (7 rows)
- registry.register: L21/code/main.py:70-79, 249
- override=True: L21/code/main.py:78, 83
- disp.dispatch: L23/code/main.py:151, 327
- idempotency_key: L23/code/main.py:157, 333-336
- chain.evaluate: L25/code/main.py:294, 355
- sandbox.run: L26/code/main.py:262, 462
- builder.span gen_ai.tool.execution: L28/code/main.py:337-343, 422-423

## Gate chain, then sandbox (13 lines)
- gates and args: L25/code/main.py:414-428 (allow-set and pattern tuples shortened)
- chain.evaluate, refused += 1, deny_reason: L25/code/main.py:274-278, 355-360
- ledger.record, BudgetGate reads ledger: L25/code/main.py:221-222, 372
- SandboxConfig(project_root), Sandbox(config).run, rm denied: L26/code/main.py:29, 128-133, 162-163, 279, 435-440, 462

## Workbench scripts (6 rows)
- bin/install.sh: PACK/bin/install.sh:24-29
- --force: PACK/bin/install.sh:19-21; P14/42-agent-workbench-capstone/docs/en.md:78
- init_agent.py probes: PACK/scripts/init_agent.py:24-54
- run_with_feedback.py, feedback_record.jsonl: PACK/scripts/run_with_feedback.py:13, 52-53
- verify_agent.py exit 1 on block: PACK/scripts/verify_agent.py:71, 83-85
- generate_handoff.py handoff.json, handoff.md: PACK/scripts/generate_handoff.py:68-71, 107

## The seven workbench surfaces
- Instructions, startup rules, forbidden actions, definition of done: P14/31-agent-workbench-why-models-fail/docs/en.md:31
- State, current task, touched files, blockers, next action: P14/31-agent-workbench-why-models-fail/docs/en.md:32
- Scope, allowed files, forbidden files, acceptance criteria: P14/31-agent-workbench-why-models-fail/docs/en.md:33
- Feedback, real command output captured into the loop: P14/31-agent-workbench-why-models-fail/docs/en.md:34
- Verification, tests, lint, smoke run, scope check: P14/31-agent-workbench-why-models-fail/docs/en.md:35
- Review, a second pass with a different role: P14/31-agent-workbench-why-models-fail/docs/en.md:36
- Handoff, what changed, why, what is left: P14/31-agent-workbench-why-models-fail/docs/en.md:37

## Defaults (8 rows)
- max_turns 8: L20/code/main.py:73
- max_tool_calls 16: L20/code/main.py:74
- max_wall_seconds 30.0: L20/code/main.py:75
- timeout_ms 30_000, override wins: L21/code/main.py:58; L23/code/main.py:203
- max_attempts 3, timeout and transient only: L23/code/main.py:136, 220-239
- concurrency 8: L23/code/main.py:137, 145
- DEFAULT_MAX_OUTPUT_BYTES 64 * 1024: L26/code/main.py:86
- observation_budget 4000: L29/code/main.py:691

## Troubleshooting (6 rows)
- illegal transition: L20/code/main.py:185-195
- requires a payload: L20/code/main.py:237-239
- budget_exceeded:turns, resume: L20/code/main.py:204, 223-227
- kind="schema" no retry: L23/docs/en.md:59
- write runs twice, idempotency_key: L23/docs/en.md:65-67
- feedback.null_exit: PACK/scripts/verify_agent.py:41-42

## Glossary (5)
- ReAct: P14/01-the-agent-loop/docs/en.md:27, 121
- OTel gen_ai.*: L28/docs/en.md:28, 44
- JSON-RPC codes: L23/code/main.py:23-25
- pass@k: L27/docs/en.md:50
- HITL: P15/10-claude-code-permission-modes/code/main.py:22, 101-102; P14/01-the-agent-loop/outputs/skill-agent-loop.md:31

## Questions and answers (4)
- budget yield: L20/docs/en.md:94
- non-idempotent timeout: L23/docs/en.md:47
- cheap gates first: L25/docs/en.md:85
- no LLM judge: P14/38-verification-gates/docs/en.md:57

## Tips (6)
- state in one function: L20/docs/en.md:104
- idempotency key from planner: L23/docs/en.md:69
- errors as observation strings: P14/01-the-agent-loop/docs/en.md:59
- hooks mutate or abort, events record: L20/docs/en.md:88
- AGENTS.md under 50 lines: P14/33-instructions-as-executable-constraints/docs/en.md:59-66
- forbidden_files: P14/36-scope-contracts/docs/en.md:49
