---
id: multi-agent
title: Multi-Agent Systems
code: MA
subtitle: Agents, handoffs, shared state and orchestrators. Pick a pattern, vote, checkpoint and fix the known failures.
hue: 290
sources: phases/16-multi-agent-and-swarms/01-why-multi-agent, phases/16-multi-agent-and-swarms/04-primitive-model, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern, phases/16-multi-agent-and-swarms/06-hierarchical-architecture, phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection, phases/16-multi-agent-and-swarms/11-handoffs-and-routines, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard, phases/16-multi-agent-and-swarms/14-consensus-and-bft, phases/16-multi-agent-and-swarms/15-voting-debate-topology, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks
source_hash: a1efdb13bbf6ade7
---

## Four primitives
type: architecture
from: phases/16-multi-agent-and-swarms/04-primitive-model/docs/en.md, phases/16-multi-agent-and-swarms/04-primitive-model/code/main.py, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/code/main.py

```arch
node | orch | 2,1 | Orchestrator | static, handoff, selector
node | ckpt | 4,1 | CheckpointStore | thread_id, super_step
node | a | 1,2 | Agent: researcher | prompt + tools
node | b | 2,2 | Agent: writer | stateless
node | c | 3,2 | Agent: reviewer | stateless
node | pool | 2,3 | SharedState | message pool
node | bb | 1,3 | Blackboard | topic pub/sub
node | ver | 3,3 | Verifier | read only
edge | orch | b | runs
edge | orch | ckpt | each step
edge | a | b | handoff
edge | b | c | handoff
edge | b | pool | append
edge | a | bb | publish
edge | pool | ver | read
```

## Coordinate agents
type: task-table
from: phases/16-multi-agent-and-swarms/04-primitive-model/code/main.py, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/code/main.py, phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/code/main.py, phases/16-multi-agent-and-swarms/11-handoffs-and-routines/code/main.py, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/code/main.py

| Task | Code |
|---|---|
| Share a message pool | `state = SharedState()` then `state.append(<msg>)` |
| Run a fixed order | `StaticOrchestrator(<order>).run(team, state)` |
| Let the agent pick next | `HandoffOrchestrator("<start>").run(team, state)` |
| Let a selector pick next | `LLMSelectorOrchestrator("<start>", round_robin_selector)` |
| Hand off with a tool | `def transfer_to_refunds() -> "Agent": return refund_agent` |
| Run a group chat | `run_groupchat(AGENTS, <selector>, max_rounds=8, label="<label>")` |
| Fan out workers | `threading.Thread(target=w.run, args=(sq, results, i))` |
| Publish to a topic | `bb.publish("<writer>", "<topic>", "<content>", "<prompt>")` |

## Vote, persist and protect
type: task-table
from: phases/16-multi-agent-and-swarms/14-consensus-and-bft/code/main.py, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/code/main.py, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py

| Task | Code |
|---|---|
| Count votes | `plurality(votes)` |
| Weight votes by confidence | `cp_wbft(votes, threshold=0.5)` |
| Leaderless pick | `decentllms(votes)` |
| Save a checkpoint | `store.write(thread_id, super_step, dict(state))` |
| Resume after a crash | `store.latest(thread_id)` |
| Give an agent a queue | `AgentQueue("<agent_id>").enqueue(<msg>)` |
| Stop a retry storm | `if not breaker.allow(): ...` then `breaker.record(ok)` |

## One supervisor run
type: flow
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/code/main.py, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md

1. **Lead**: `plan(query)` splits the query into sub-questions.
2. **Lead**: Starts one `Worker` thread for each sub-question.
3. **Worker**: Starts from a fresh context with one narrow question.
4. **Worker**: Writes a `WorkerResult` with summary and `tokens_spent`.
5. **Lead**: Joins all threads. Wall clock is about the slowest worker.
6. **Lead**: `synthesize(query, results)` merges the answers.
7. **Lead**: Reports `wall_clock_seconds`, `total_tokens` and `worker_count`.

## Handoff loop (Swarm style)
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/11-handoffs-and-routines/code/main.py

```python
def run_swarm(start_agent: Agent, user_messages: list[str]) -> list[Msg]:
    history: list[Msg] = []
    active = start_agent                      # who holds the chat
    for user in user_messages:
        history.append(Msg(role="user", content=user))
        out = scripted_router(active, user)   # stands in for an LLM
        if isinstance(out, Agent):            # a tool returned an agent
            history.append(
                Msg(role="assistant", content=f"(handoff to {out.name})", sender=active.name)
            )
            active = out                      # switch the active agent
            out = scripted_router(active, user)
        history.append(Msg(role="assistant", content=str(out), sender=active.name))
    return history                            # nothing persists
```

## Confidence-weighted vote
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/14-consensus-and-bft/code/main.py

```python
def cp_wbft(votes: list[Vote], threshold: float = 0.5):
    weights: dict[str, float] = {}
    rep: dict[str, str] = {}
    for v in votes:
        key = v.canonical()                   # cluster equal answers
        weights[key] = weights.get(key, 0.0) + v.confidence
        rep.setdefault(key, v.answer)
    total = sum(weights.values()) or 1.0
    winner_key = max(weights, key=weights.get)
    if weights[winner_key] / total < threshold:
        return None, weights                  # too weak: retry or escalate
    return rep[winner_key], weights
```

## Pick a pattern
type: concepts
from: phases/16-multi-agent-and-swarms/01-why-multi-agent/docs/en.md, phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/docs/en.md, phases/16-multi-agent-and-swarms/11-handoffs-and-routines/docs/en.md, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/docs/en.md

- **Pipeline**: Each agent transforms and passes on. One failed stage blocks the rest.
- **Fan-out / fan-in**: Split into parallel agents, then merge. For independent subtasks.
- **Supervisor**: Lead plans, delegates and synthesizes. Wrong for sequential tasks.
- **Hierarchical**: Supervisors over supervisors. Only leaves work.
- **Group chat**: Peers share a pool. A selector picks the next speaker.
- **Handoff**: The active agent calls a tool that returns the next agent.
- **Blackboard**: Topic pub/sub. Wins with many agents on long runs.
- **Single agent**: Under 20 tool calls and 100k tokens, stay single.

## Defaults in the code
type: defaults
from: phases/16-multi-agent-and-swarms/04-primitive-model/code/main.py, phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/code/main.py, phases/16-multi-agent-and-swarms/14-consensus-and-bft/code/main.py, phases/16-multi-agent-and-swarms/15-voting-debate-topology/code/main.py, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_steps` | 10 | Every orchestrator `run` |
| `max_rounds` | 8 | Group chat demo cap |
| `TERMINATE` | TERMINATE | Token that ends a group chat |
| `threshold` | 0.5 | `cp_wbft` acceptance share |
| `rounds` | 2 | Graph topology debate rounds |
| `failure_threshold` | 0.5 | Breaker opens above this error rate |
| `window_size` | 20 | Breaker outcomes in the window |
| `open_cooldown_s` | 0.5 | Seconds before half open |

## Troubleshooting
type: troubleshooting
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/docs/en.md, phases/16-multi-agent-and-swarms/11-handoffs-and-routines/docs/en.md, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/docs/en.md, phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/16-multi-agent-and-swarms/15-voting-debate-topology/docs/en.md, phases/16-multi-agent-and-swarms/04-primitive-model/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| One agent talks every turn | Hot speaker in the selector | Add speaker balance to the selector |
| Context grows each turn | Every agent reads every message | Give agents projections |
| Two agents hand back and forth | Handoff loop | Cap `max_steps` on the orchestrator |
| A wrong number spreads to all | Memory poisoning in shared state | Provenance, append only, read-only verifier |
| Majority is wrong together | Monoculture, same base model | Mix base models |
| Workers research the wrong target | Manager split drifted from the goal | Add a canary question worker |
| Workers disagree, one side wins | Silent synthesis conflict | Re-ask or report the disagreement |
| Downstream load grows 10x | Retry storm | Circuit breaker, capped retries |

## Glossary
type: glossary
from: phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md

- **BFT**: Byzantine fault tolerance. Tolerates `f < n/3` faulty nodes.
- **CP-WBFT**: Confidence-Probed Weighted BFT. Votes weighted by confidence.
- **MAST**: Failure taxonomy. Specification, coordination, verification.
- **MARBLE**: MultiAgentBench. Star, chain, tree and graph topologies.
- **Super-step**: Unit of work between two checkpoints.
- **Outbox pattern**: Write the side effect intent first. A separate executor runs it.

## Q&A
type: qa
from: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/docs/en.md, phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/en.md, phases/16-multi-agent-and-swarms/15-voting-debate-topology/docs/en.md, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md

- **What does multi-agent cost?** About 15 times the tokens of a single agent.
- **Why can the verifier not write?** A poisoned pool then cannot poison it.
- **Which threshold for 5 to 7 voters?** 0.5 to 0.67. Below it, escalate.
- **More agents or other models?** Other models. Three models beat five copies of one.
- **Most common failure?** Specification problems, 41.77% of MAST failures.

## Tips
type: tips
from: phases/16-multi-agent-and-swarms/04-primitive-model/docs/en.md, phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md, phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/en.md, phases/16-multi-agent-and-swarms/15-voting-debate-topology/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md

- Shared state is the only stateful part. Look there first for bugs.
- Keep hierarchies at depth 2 or less.
- Bound debate rounds to 2 or 3.
- Past about 4 agents in a graph, the coordination tax grows.
- Use async I/O for LLM calls. Threads cost about 1MB each.
- Put a dedup key in every side-effect call.
