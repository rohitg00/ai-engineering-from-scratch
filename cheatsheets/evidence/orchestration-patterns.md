# Evidence: cheatsheets/orchestration-patterns.md

Abbreviations: L28 = phases/14-agent-engineering/28-orchestration-patterns, L12 = phases/14-agent-engineering/12-anthropic-workflow-patterns, L05 = phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern, L06 = phases/16-multi-agent-and-swarms/06-hierarchical-architecture, L09 = phases/16-multi-agent-and-swarms/09-parallel-swarm-networks. d = docs/en.md, c = code/main.py.

## Four topologies side by side (comparison)
- Who routes: central routing LLM L28/d:25, no central router L28/d:36, supervisors managing sub-supervisors L28/d:44, parallel proposers L28/d:52
- Agents talk: all routing through supervisor L28/d:27, direct handoffs L28/d:35, only leaves do work L06/d:34, cross-critique L28/d:52
- Demo trace: cleanest, shortest, deepest, most expensive L28/d:103
- Fits: 2-4 specialists L28/d:71, latency over reasoning clarity L28/d:72, large agent populations L28/d:46, accuracy over cost L28/d:74
- Weak point: supervisor bottleneck L09/d:12, harder to reason about L28/d:38, decomposition drift L06/d:119, cost L28/d:74
- Frameworks: `create_supervisor` L28/d:29, swarm topology L28/d:40, nested subgraphs or crews L28/d:45, custom for debate L28/d:110

## Decision order (flow)
1. Single agent plus workflow patterns: L28/d:70
2. Supervisor-worker with 2-4 specialists: L28/d:71
3. Swarm when latency matters more: L28/d:72
4. Hierarchical when context budget fails: L28/d:73
5. Debate when accuracy matters more than cost: L28/d:74

## Supervisor with parallel workers (architecture)
- User query goes to Lead.run(query): L05/d:85, L05/c:87
- Lead.plan(query) splits into 3 sub-questions: L05/d:83, L05/c:74-80
- Worker 0 with fresh context: L05/d:34, 44, L05/c:95-98
- Worker 1 with fresh context: L05/d:34, 44, L05/c:95-98
- Worker 2 with fresh context: L05/d:34, 44, L05/c:95-98
- Lead synthesizes from worker summaries only: L05/d:14, 38, L05/c:82-85, 104
- Edges sub_q and summary: L05/c:54, 57-61, 84

## Use each pattern when (tips)
- Workflow when steps can be enumerated: L12/d:48
- Agent when next step depends on last: L12/d:54
- Supervisor, own 200k-token window: L05/d:14
- Swarm for many independent, variable-duration tasks: L09/d:38-39
- Hierarchical for independent sub-teams: L06/d:51
- Sequential when step 2 needs step 1: L05/d:69
- Static graphs for audit/replay: L05/d:71
- CrewAI Flow production start, Crew autonomous roles: L28/d:59-60

## Five workflow patterns in code (task-table)
- `prompt_chain(input_text, llm, steps)`, output N to N+1: L12/c:33-34, L12/d:109
- `route(input_text, classifier, handlers)`: L12/c:45-46
- `parallel_vote(prompt, llm, n=5)`: L12/c:54, majority L12/d:40
- `orchestrator_workers(task, workers, synth)`: L12/c:68-69, 160
- `evaluator_optimizer(task, proposer, evaluator, max_iter=5)`: L12/c:77-79, PASS L12/c:85
- `handlers.get(label) or handlers.get("default")`: L12/c:48
- `python3 code/main.py`: L12/d:79

## Lead fans out to threads (annotated-code)
- plan, results, threads list: L05/c:89, 92-93
- Worker and Thread per sub-question, start: L05/c:94-98
- join loop: L05/c:100-101, wall time max not sum L05/d:46
- synthesize call: L05/c:104

## Swarm workers pull from one queue (annotated-code)
- queue creation and put: L09/c:62-64
- worker loop, get_nowait, queue.Empty return: L09/c:68-73
- fake_work, lock, counts, task_done: L09/c:74-77, fast workers pull next jobs L09/d:39

## Limits and budgets (defaults)
- Swarm hops 3, `while hops < 3`: L28/c:51, bouncing L28/d:79, 119
- `parallel_vote` n 5: L12/c:54
- `max_iter` 5: L12/c:79
- Tree depth 2: L06/d:100
- Reconciliation rounds 2: L06/d:101
- Worker timeout 2× median runtime: L05/d:104
- Worker token cap 10× expected synthesis input: L05/d:105
- Supervisor specialists 2-4: L28/d:71

## Numbers that matter (concepts)
- +90.2% over single-agent Opus 4: L05/d:3
- 80% of BrowseComp variance from token usage: L05/d:3, 16
- ~15× the tokens: L05/d:55
- 3-10 tool calls, 10+ agents: L05/d:52
- 0.3-second workers in ~0.35 seconds, not 0.9: L05/d:93
- 8 tasks, 4 slow (0.4s), 4 fast (0.1s), 4 workers: L09/c:92, 97, 107, 111
- ~10-15 lines per pattern: L12/d:82

## Failures and fixes (troubleshooting)
- Lead hallucinates plan, log and diff decomposition: L05/d:63, L06/d:103
- Workers over-explore, scope boundaries: L05/d:64
- Silent picking, re-ask or note disagreement: L05/d:65
- Manager mislabels branch, canary worker: L06/d:45, 82, 109
- Consensus loops, reconciliation budget: L06/d:47, 101
- Starvation, priority queue with aging: L09/d:60, 63
- Crash mid-run, idempotent workers, durable queue: L09/d:102-103

## Workflow or agent (comparison)
- Engineers own the graph, model owns the graph: L12/d:25-26
- Bounded step counts, agents can spiral: L12/d:49
- Easier to debug, harder failure modes: L12/d:28
- Auditors read the graph, not infer from trajectories: L12/d:50
- Predictable tasks, open-ended research: L12/d:48, 54

## Questions (qa)
- Tool-call supervision, decide what each specialist sees: L28/d:31
- Fresh context per subagent is the main mechanism: L05/d:16
- Rainbow deployments, long-running stateful, blue-green fails: L05/d:54
- Error surfaces at top synthesis, one level removed: L06/d:45
- Swarm gives independent facts, not a coherent report: L09/d:45
- Trace ID per task, log start/end: L09/d:104
