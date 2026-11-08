# Evidence: cheatsheets/multi-agent.md

Abbreviations: 04 = phases/16-multi-agent-and-swarms/04-primitive-model, D = docs/en.md, C = code/main.py, 22 = phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints, 13 = phases/16-multi-agent-and-swarms/13-shared-memory-blackboard, 11 = phases/16-multi-agent-and-swarms/11-handoffs-and-routines, 10 = phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection, 05 = phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern, 14 = phases/16-multi-agent-and-swarms/14-consensus-and-bft, 23 = phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink, 01 = phases/16-multi-agent-and-swarms/01-why-multi-agent, 06 = phases/16-multi-agent-and-swarms/06-hierarchical-architecture, 15 = phases/16-multi-agent-and-swarms/15-voting-debate-topology, 24 = phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks.

Lesson directories are shortened to their number:, and so on.

## Four primitives (architecture, 8 nodes, 7 edges)
- Orchestrator static, handoff, selector: 04/D:23; 04/C:82-128
- CheckpointStore thread_id, super_step, each step: 22/C:22-48; 22/D:52
- Agent researcher, prompt + tools: 04/C:76; 04/D:21
- Agent writer, stateless: 04/C:77; 04/D:54
- Agent reviewer, stateless: 04/C:78; 04/D:54
- handoff edges: 04/C:59, 65; 04/D:22
- SharedState message pool, append: 04/C:23-30; 04/D:24
- Blackboard topic pub/sub, publish: 13/D:47; 13/C:68-104
- Verifier read only, reads pool: 13/D:71, 93-102

## Coordinate agents (task-table, 8)
- SharedState(), append: 04/C:24-30
- StaticOrchestrator(order).run(team, state): 04/C:82-91, 155
- HandoffOrchestrator(start).run: 04/C:94-110, 160
- LLMSelectorOrchestrator(start, round_robin_selector): 04/C:113-128, 165
- transfer_to_refunds returns an Agent: 11/C:29-31
- run_groupchat(AGENTS, selector, max_rounds=8, label): 10/C:85-90, 121
- threading.Thread(target=w.run, args=(sq, results, i)): 05/C:96-100
- bb.publish(writer, topic, content, prompt): 13/C:77, 206

## Vote, persist and protect (task-table, 7)
- plurality(votes): 14/C:25, 80
- cp_wbft(votes, threshold=0.5): 14/C:36, 81
- decentllms(votes): 14/C:50, 82
- store.write(thread_id, super_step, dict(state)): 22/C:67
- store.latest(thread_id): 22/C:54
- AgentQueue(id).enqueue(msg): 22/C:81-88, 105
- breaker.allow(), breaker.record(ok): 23/C:126, 133

## One supervisor run (flow, 7)
1. plan(query) sub-questions: 05/C:74-80, 89
2. one Worker thread per sub-question: 05/C:92-97
3. fresh context, narrow question: 05/D:44
4. WorkerResult with summary and tokens_spent: 05/C:58-64
5. join, wall clock is max of workers: 05/C:99-100; 05/D:46
6. synthesize(query, results): 05/C:82-85, 103
7. wall_clock_seconds, total_tokens, worker_count: 05/C:104-110

## Handoff loop (annotated-code, 14 lines)
- all lines: 11/C:113-126. scripted_router stands in for an LLM: 11/C:86-88. Stateless: 11/D:47

## Confidence-weighted vote (annotated-code, 12 lines)
- all lines: 14/C:36-47 (return type annotation left out of the def line). canonical clusters answers: 14/C:20-22. retry or escalate below threshold: 14/D:69, 78

## Pick a pattern (concepts, 8)
- Pipeline: 01/D:154
- Fan-out / fan-in: 01/D:166
- Supervisor, wrong for sequential tasks: 05/D:69
- Hierarchical, only leaves work: 06/D:117
- Group chat selector: 10/D:84-90
- Handoff tool returns agent: 11/D:126
- Blackboard wins with many agents, long runs: 13/D:47
- Single agent under 20 tool calls and 100k tokens: 01/D:220

## Defaults in the code (defaults, 8)
- max_steps 10: 04/C:88; 04/C:100; 04/C:121
- max_rounds 8: 10/C:121
- TERMINATE: 10/C:32; 10/C:49; 10/C:103
- threshold 0.5: 14/C:36
- rounds 2: 15/C:79
- failure_threshold 0.5: 23/C:66
- window_size 20: 23/C:67
- open_cooldown_s 0.5: 23/C:68

## Troubleshooting (8)
- hot speaker, speaker balance: 10/D:82
- context bloat, projections: 10/D:81
- handoff loop: 11/D:130. max_steps cap: 04/C:100-102
- memory poisoning, provenance, append only, verifier: 13/D:69-71
- monoculture, mix models: 14/D:38; 15/D:80
- decomposition drift, canary question: 06/D:119, 122
- synthesis conflict: 05/D:65
- retry storm 10x, circuit breaker: 23/D:86, 91

## Glossary (6)
- BFT f < n/3: 14/D:22, 140
- CP-WBFT: 14/D:42
- MAST: 23/D:190
- MARBLE: 24/D:137
- Super-step: 22/D:168
- Outbox pattern: 22/D:99, 171

## Q&A (5)
- about 15 times the tokens: 05/D:55
- unwritable verifier: 13/D:71, 102
- threshold 0.5 to 0.67 for 5 to 7 agents: 14/D:78
- three models beat five copies: 15/D:80
- specification problems 41.77%: 23/D:20

## Tips (6)
- shared state is the only stateful part: 04/D:54
- depth 2 ceiling: 06/D:121
- bound rounds 2 or 3: 14/D:84; 15/D:90
- coordination tax past about 4 agents: 15/D:59
- async I/O, threads about 1MB: 22/D:75
- dedup key in every side-effect call: 22/D:98
