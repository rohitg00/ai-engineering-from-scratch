---
id: agent-state-graphs
title: Agent State Machines and Durable Graphs
code: AM
subtitle: State, nodes, edges, reducers, checkpoints, interrupts and leased job recovery. LangGraph and a Go job queue.
hue: 165
sources: phases/11-llm-engineering/16-langgraph-state-machines, phases/14-agent-engineering/13-langgraph-stateful-graphs, projects/durable-agent-jobs
source_hash: 9903f6332bc1bd69
---

## The parts of a state graph
type: concepts
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md

- **State**: a typed dict that flows through the graph. Each node gets the full state.
- **Node**: a function `state -> partial_state`. One discrete step.
- **Edge**: static edges go to one node. Conditional edges call a router function.
- **Reducer**: `(old, new) -> merged` per field. Default is overwrite.
- **Thread**: a `thread_id` string that scopes all checkpoints of one session.
- **Checkpoint**: the full state after a node, keyed on `(thread_id, checkpoint_id)`.
- **Send**: a node returns `Send(node_name, state)` to run nodes in parallel.
- **Subgraph**: a compiled graph used as one node in another graph.

## The four-node ReAct graph
type: annotated-code
lang: python
from: phases/11-llm-engineering/16-langgraph-state-machines/code/main.py, phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md

```python
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]  # append, not overwrite
def should_continue(state: State) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END
graph = StateGraph(State)
graph.add_node("agent", agent_node)  # calls the LLM
graph.add_node("tools", ToolNode(TOOLS))  # runs tool_calls
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")  # static edge back
app = graph.compile(checkpointer=MemorySaver(),
                    interrupt_before=["tools"])  # pause before side effects
```

## ReAct loop with a checkpointer
type: architecture
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md

```arch
node | user | 1,1 | User | thread_id | client
node | agent | 2,1 | agent | calls the LLM | model
node | tools | 3,1 | tools | ToolNode | process
node | end | 2,2 | END | no tool_calls |
node | ckpt | 3,2 | Checkpointer | state after each node | store
edge | user | agent | messages
edge | agent | tools | tool_calls
edge | tools | agent | tool results
edge | agent | end | done
edge | tools | ckpt | save
```

## Graph tasks
type: task-table
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/11-llm-engineering/16-langgraph-state-machines/code/main.py

| Task | Code |
|---|---|
| Set the thread | `{"configurable": {"thread_id": "<id>"}}` |
| Stream deltas | `app.stream(<state>, config, stream_mode="updates")` |
| Read paused state | `app.get_state(config)` |
| Approve and resume | `app.invoke(Command(resume=True), config)` |
| Deny with a message | `app.update_state(config, {"messages": [...]})` |
| List checkpoints | `list(app.get_state_history(config))` |
| Replay from a checkpoint | `app.stream(None, <old_config>)` |
| Postgres store | `PostgresSaver.from_conn_string(<url>)` |

## Stream modes
type: comparison
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md

| Factor | `updates` | `messages` | `values` |
|---|---|---|---|
| Yields | State deltas | LLM tokens | Full snapshots |
| Shape | `{node_name: state_delta}` | Tokens in model nodes | Whole state |
| Use for | The UI | Token streaming | Eval |

## Pause, approve, resume
type: flow
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/11-llm-engineering/16-langgraph-state-machines/code/main.py

1. **Compile**: set `interrupt_before=["tools"]` and a checkpointer.
2. **Run**: the graph stops before `tools`. The state persists.
3. **API**: answers the user with "awaiting approval".
4. **Reviewer**: reads the pending `tool_calls` from `app.get_state(config)`.
5. **Approve**: send `Command(resume=True)` on the same `thread_id`.
6. **Deny**: write a rejection message with `app.update_state`, then resume.

## Stdlib graph: pause and resume
type: flow
from: phases/14-agent-engineering/13-langgraph-stateful-graphs/code/main.py, phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md

1. **classify**: sets `route` to refund, bug or sales.
2. **Router**: `add_conditional_edges` picks the branch node from `route`.
3. **Branch**: writes a `ticket` such as `BUG-...`.
4. **human_gate**: no `human_approval`, so it sets `_pause_reason`.
5. **Runner**: saves the state, then raises `PausedAtNode`.
6. **Human**: `load_latest(session)`, set `human_approval` to True.
7. **Resume**: `runner.run(..., resume_from="send", state_override=...)`.

## Durable job states
type: architecture
from: projects/durable-agent-jobs/solution/stage1.go, projects/durable-agent-jobs/solution/stage2.go, projects/durable-agent-jobs/solution/stage3.go

```arch
node | new | 1,1 | NewJob | version 0 |
node | q | 2,1 | queued | waits for a claim | queue
node | r | 3,1 | running | LeaseUntil = now + ttl | process
node | c | 4,1 | completed | LeaseUntil 0 | store
node | lim | 2,2 | ErrLimit | Attempts at cap |
edge | new | q |
edge | q | r | ClaimJob
edge | r | c | Finish
edge | r | q | Reclaim
edge | q | lim | cap
```

## Run the job queue
type: command-table
from: projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/API.md

| Command | What it does |
|---|---|
| `go build -o /tmp/durable-jobs .` | Builds the reference worker |
| `enqueue --store "$STORE" --input samples/jobs.json` | Adds id/text records |
| `worker --store "$STORE" --max-jobs 100` | Claims and runs jobs |
| `status --store "$STORE"` | Shows jobs, effects and scope |
| `worker ... --crash-after effect` | Exits 86 after the receipt |
| `worker ... --now-ms 111 --lease-ms 10` | Recovers the expired claim |
| `--crash-after claim` | Crash before any output exists |
| `go run . demo` | Automated effect crash sequence |

## Worker defaults
type: defaults
from: projects/durable-agent-jobs/API.md, projects/durable-agent-jobs/solution/main.go, projects/durable-agent-jobs/solution/stage4.go, projects/durable-agent-jobs/README.md

| Setting | Default | Note |
|---|---|---|
| `--lease-ms` | 30000 | Claim lease in milliseconds |
| `--max-attempts` | 3 | Job stays visible at the cap |
| `--max-jobs` | 1 | Jobs per worker call |
| `--delay-ms` | 0 | Range 0..60000 |
| `--now-ms` | -1 | Means current wall time |
| `--store` | jobs-data | Local directory |
| Snapshot size | 4 MiB | `ErrLimit` above it |

## Troubleshooting
type: troubleshooting
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md, projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/API.md, projects/durable-agent-jobs/solution/stage3.go

| Symptom | Cause | Fix |
|---|---|---|
| Half the turn lost | No `add_messages` reducer | `Annotated[list, add_messages]` |
| No resume or time-travel | No checkpointer | `MemorySaver` in tests, a real store in prod |
| Harm before approval | Interrupt after the side effect | Interrupt before the side effect node |
| Tool state lost on resume | Checkpoints too small | Serialize the full state |
| Resume gives a new result | Non-deterministic node | Capture seeds, clock and API replies |
| Old worker completion fails | Version or lease changed | Expected. `Finish` fences stale workers |
| Enqueue `conflict` | Changed text under an old ID | Use a new identifier |
| Exit code 86 | `--crash-after` set | Expected. Run the worker again |

## Q&A
type: qa
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md, projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/solution/stage2.go, projects/durable-agent-jobs/solution/stage3.go

- **What does `None` as input do?** It replays from the given checkpoint.
- **Why completed v4 after one crash?** Claim, reclaim, claim and finish each add 1.
- **Is execution exactly once?** No. It is at least once.
- **Why no duplicate receipt?** The local immutable receipt makes the effect idempotent.
- **When does `Reclaim` fire?** On a running job with `now` at or past `LeaseUntil`.
- **Which three topologies?** Supervisor, swarm and hierarchical.

## Tips
type: tips
from: phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md, phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md, projects/durable-agent-jobs/README.md

- Name the nodes first. Each decision or side effect is a node.
- Hoist task fields such as `plan` and `budget` out of `messages`.
- Prefer linear chains with occasional branches.
- Put approvals on the edge into a side-effecting node.
- Do not put the job store on NFS.
- Use a new store for each repeatable crash test.
