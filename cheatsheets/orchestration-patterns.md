---
id: orchestration-patterns
title: Orchestration Patterns Compared
code: OP
subtitle: Pick supervisor, swarm, hierarchical, debate or a plain workflow. Stdlib Python from the lessons.
hue: 285
sources: phases/14-agent-engineering/28-orchestration-patterns, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern, phases/16-multi-agent-and-swarms/06-hierarchical-architecture, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks, phases/14-agent-engineering/12-anthropic-workflow-patterns
source_hash: c3f552bc4f7bff2a
---

## Four topologies side by side
type: comparison
span: 2
from: phases/14-agent-engineering/28-orchestration-patterns/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md

| Factor | Supervisor-worker | Swarm | Hierarchical | Debate |
|---|---|---|---|---|
| Who routes | One central LLM | No central router | Supervisors of supervisors | Parallel proposers |
| Agents talk | Only through the supervisor | Direct handoffs | Only leaves do work | Cross-critique |
| Demo trace | Cleanest | Shortest | Deepest | Most expensive |
| Fits | 2-4 specialists | Latency over reasoning clarity | Large agent populations | Accuracy over cost |
| Weak point | Supervisor is the bottleneck | Hard to reason about | Decomposition drift | Cost |
| Frameworks | LangGraph `create_supervisor` | LangGraph swarm topology | Nested subgraphs or crews | Custom |

## Decision order
type: flow
from: phases/14-agent-engineering/28-orchestration-patterns/docs/en.md

1. **Single agent**: start with workflow patterns from Lesson 12.
2. **Supervisor-worker**: when you have 2-4 specialists.
3. **Swarm**: when latency matters more than reasoning clarity.
4. **Hierarchical**: only when supervisor context budget fails.
5. **Debate**: when accuracy matters more than cost.

## Supervisor with parallel workers
type: architecture
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/code/main.py

```arch
node | q | 1,2 | User query | | client
node | plan | 2,2 | Lead.plan | 3 sub-questions | model
node | w0 | 3,1 | Worker 0 | fresh context | process
node | w1 | 3,2 | Worker 1 | fresh context | process
node | w2 | 3,3 | Worker 2 | fresh context | process
node | syn | 4,2 | Lead synthesizes | summaries only | model
edge | q | plan |
edge | plan | w0 | sub_q
edge | plan | w1 | sub_q
edge | plan | w2 | sub_q
edge | w0 | syn | summary
edge | w1 | syn | summary
edge | w2 | syn | summary
```

## Use each pattern when
type: tips
from: phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/14-agent-engineering/28-orchestration-patterns/docs/en.md

- Use a workflow when you can enumerate the steps.
- Use an agent when the next step depends on what the last step returned.
- Use supervisor for research: each worker gets its own 200k-token window.
- Use swarm for many independent tasks with variable duration.
- Use hierarchical when the task has real independent sub-teams.
- Use sequential when step 2 needs the output of step 1.
- Use static graphs when audit and replay matter more than adaptability.
- Use CrewAI Flow as the production starting point. Use Crew for autonomous roles.

## Five workflow patterns in code
type: task-table
span: 2
from: phases/14-agent-engineering/12-anthropic-workflow-patterns/code/main.py, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md

| Task | Code |
|---|---|
| Prompt chaining: output N feeds call N+1 | `prompt_chain(input_text, llm, steps)` |
| Routing: classify, then dispatch | `route(input_text, classifier, handlers)` |
| Parallelization: N runs, majority wins | `parallel_vote(prompt, llm, n=5)` |
| Orchestrator-workers: pick workers, synthesize | `orchestrator_workers(task, workers, synth)` |
| Evaluator-optimizer: loop until PASS | `evaluator_optimizer(task, proposer, evaluator, max_iter=5)` |
| Fallback handler for an unknown label | `handlers.get(label) or handlers.get("default")` |
| Run all five demos | `python3 code/main.py` |

## Lead fans out to threads
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/code/main.py

```python
sub_questions = self.plan(query)                  # 3 sub-questions
results: list[WorkerResult | None] = [None] * len(sub_questions)
threads: list[threading.Thread] = []
for i, sq in enumerate(sub_questions):
    w = Worker(worker_id=i, trace=self.trace)     # fresh worker per sub-question
    th = threading.Thread(target=w.run, args=(sq, results, i))
    threads.append(th)
    th.start()                                    # all workers run at once
for th in threads:
    th.join()                                     # wall time near max, not sum
synthesis = self.synthesize(query, [r for r in results if r is not None])
```

## Swarm workers pull from one queue
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/code/main.py

```python
q: queue.Queue = queue.Queue()
for t in tasks:
    q.put(t)                          # no orchestrator assigns work
def worker(wid: int) -> None:
    while True:
        try:
            task = q.get_nowait()
        except queue.Empty:
            return                    # queue drained, worker exits
        fake_work(task)
        with lock:
            counts[wid] += 1          # fast workers pull more jobs
        q.task_done()
```

## Limits and budgets
type: defaults
from: phases/14-agent-engineering/28-orchestration-patterns/code/main.py, phases/14-agent-engineering/28-orchestration-patterns/docs/en.md, phases/14-agent-engineering/12-anthropic-workflow-patterns/code/main.py, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Swarm hops | 3 | `while hops < 3` stops A to B to A bouncing |
| `parallel_vote` `n` | 5 | Same prompt, majority vote |
| `max_iter` | 5 | Evaluator-optimizer stops after 5 tries |
| Tree depth | 2 | Three levels hide most errors |
| Reconciliation rounds | 2 | Then the top manager must commit |
| Worker timeout | 2× median runtime | Kill, then respawn narrower or skip |
| Worker token cap | 10× | Of the expected synthesis input |
| Supervisor specialists | 2-4 | Step 2 of the decision order |

## Numbers that matter
type: concepts
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/code/main.py, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md

- **Research gain**: +90.2% over single-agent Opus 4 on internal research evals.
- **Token share**: 80% of BrowseComp variance comes from token usage alone.
- **Token cost**: multi-agent is ~15× the tokens of single-agent.
- **Scale effort**: simple queries use one agent and 3-10 tool calls. Complex ones use 10+ agents.
- **Wall clock**: three 0.3-second workers finish in ~0.35 seconds, not 0.9.
- **Swarm demo**: 8 tasks, 4 slow (0.4s) and 4 fast (0.1s), 4 workers.
- **Pattern size**: each workflow pattern is ~10-15 lines of code.

## Failures and fixes
type: troubleshooting
col: 3
from: phases/14-agent-engineering/28-orchestration-patterns/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Precise answers to the wrong question | Lead hallucinates the plan | Log the plan, diff it against the query |
| Synthesis gets polluted | Workers over-explore | Set explicit scope boundaries |
| User never sees a conflict | Lead silently picks one side | Re-ask or state the disagreement |
| Branch answers the wrong topic | Manager mislabels a branch | Add a canary worker with the original query |
| Sub-managers loop | Consensus loop | Set a reconciliation budget |
| Long tasks never run | Queue starvation | Priority queue with aging |
| Task runs twice after a crash | Worker crashed mid-run | Make workers idempotent, use a durable queue |

## Workflow or agent
type: comparison
from: phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md

| Factor | Workflow | Agent |
|---|---|---|
| Who owns the graph | Engineers | The model |
| Step count | Bounded | Can spiral |
| Debugging | Easier | Harder failure modes |
| Audit | Auditors read the graph | Inferred from trajectories |
| Fits | Predictable tasks | Open-ended research |

## Questions
type: qa
from: phases/14-agent-engineering/28-orchestration-patterns/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md

- **Why supervise through tool calls?** You decide exactly what each specialist sees.
- **Why does supervisor win on research?** Fresh context per subagent is the main mechanism.
- **Why rainbow deployments?** Agents are long-running and stateful. Blue-green does not work.
- **Where does a hierarchy error show?** At the top synthesis, one level from where a human could catch it.
- **Why not swarm for a report?** A swarm of researchers gives independent facts, not a coherent report.
- **How do you debug a swarm?** Give every task a trace ID. Log start and end with it.
