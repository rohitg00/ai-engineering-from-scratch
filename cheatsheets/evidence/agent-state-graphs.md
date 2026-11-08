# Evidence: cheatsheets/agent-state-graphs.md

Abbreviations: L16 = phases/11-llm-engineering/16-langgraph-state-machines, L13 = phases/14-agent-engineering/13-langgraph-stateful-graphs, P = projects/durable-agent-jobs. d = docs/en.md, c = code/main.py, s = solution/.

## The parts of a state graph (concepts, 8)
- State typed dict, every node gets full state: L16/d:24
- Node `state -> partial_state`, discrete step: L16/d:25
- Static and conditional edges with router function: L16/d:26
- Reducer `(old, new) -> merged`, default overwrite: L16/d:192, L16/d:42
- Thread `thread_id` scopes checkpoints: L16/d:193
- Checkpoint keyed on `(thread_id, checkpoint_id)`: L16/d:28, L16/d:194
- Send(node_name, state) parallel: L16/d:57
- Subgraph compiled graph as node: L16/d:61, L13/d:115

## The four-node ReAct graph (annotated-code, 14 lines)
- State with add_messages: L16/c:41-42. append not overwrite: L16/d:102
- should_continue: L16/c:86-88
- StateGraph, add_node agent/tools, ToolNode(TOOLS): L16/c:90-94
- set_entry_point, add_conditional_edges, add_edge: L16/c:95-97
- compile with MemorySaver and interrupt_before=["tools"]: L16/c:99-102. pause before side effect: L16/c:8-9

## ReAct loop with a checkpointer (architecture, 5 nodes, 5 edges)
- user invokes with thread_id: L16/d:28
- agent calls the LLM: L16/d:48
- tools runs tool_calls via ToolNode: L16/d:49, L16/d:90
- END when no tool_calls, static edge back from tools: L16/d:50-51
- checkpointer writes state after every node transition: L16/d:32

## Graph tasks (task-table, 8)
- configurable thread_id: L16/d:107
- app.stream stream_mode="updates": L16/d:108-111
- app.get_state(config): L16/c:130
- app.invoke(Command(resume=True), config): L16/d:132
- app.update_state(config, {"messages": ...}): L16/d:134
- list(app.get_state_history(config)): L16/d:142
- app.stream(None, target): L16/d:148, 152
- PostgresSaver.from_conn_string: L16/d:157-159

## Stream modes (comparison, 3 rows)
- Yields: deltas, tokens, full snapshots: L16/d:36
- Shape: `{node_name: state_delta}`: L16/d:116
- Use for: UI, token streaming, eval: L16/d:177

## Pause, approve, resume (flow, 6)
1. interrupt_before=["tools"] with checkpointer: L16/d:123-126
2. stops before node, state persists: L16/d:34, 137
3. "awaiting approval": L16/d:34
4. pending tool_calls from app.get_state: L16/c:129-134
5. Command(resume=True), same thread_id: L16/d:34, 132
6. deny with update_state rejection message: L16/d:133-134

## Stdlib graph: pause and resume (flow, 7)
1. _classify sets route refund/bug/sales: L13/c:123-133
2. add_conditional_edges router on route: L13/c:173-177
3. ticket BUG-...: L13/c:141-143
4. human_gate sets _pause_reason without human_approval: L13/c:151-154
5. Runner saves then raises PausedAtNode: L13/c:115-118
6. load_latest, human_approval True: L13/c:213-216
7. runner.run resume_from="send", state_override: L13/c:220-225

## Durable job states (architecture, 5 nodes, 5 edges)
- NewJob queued, version zero: P/s/stage1.go:5-9
- ClaimJob queued to running, LeaseUntil = now + ttl: P/s/stage2.go:6, 15-18
- ErrLimit at attempt cap: P/s/stage2.go:12-13
- Finish running to completed, LeaseUntil 0: P/s/stage3.go:3-9
- Reclaim running to queued: P/s/stage3.go:12-18

## Run the job queue (command-table, 8)
- go build -o /tmp/durable-jobs .: P/README.md:31
- enqueue --store "$STORE" --input samples/jobs.json: P/README.md:33. id/text: P/API.md:7
- worker --max-jobs 100: P/README.md:34
- status: P/README.md:35. jobs, effects and scope: P/API.md:9
- --crash-after effect exits 86: P/README.md:45, 51
- --now-ms 111 --lease-ms 10 recovery: P/README.md:47
- --crash-after claim before output: P/README.md:51
- go run . demo: P/README.md:51

## Worker defaults (defaults, 7)
- --lease-ms 30000: P/API.md:14, P/s/main.go:68
- --max-attempts 3, job stays visible at the cap: P/s/main.go:69, P/README.md:72
- --max-jobs 1: P/s/main.go:70
- --delay-ms 0, range 0..60000: P/s/main.go:71, P/API.md:14
- --now-ms -1 means wall time: P/s/main.go:67
- --store jobs-data: P/s/main.go:65
- 4 MiB snapshot, ErrLimit: P/README.md:72, P/s/stage4.go:35-36

## Troubleshooting (troubleshooting, 8)
- lost half turn without add_messages: L16/d:42
- no checkpointer means no resume/time-travel, MemorySaver for tests: L16/d:175
- interrupt before side effect: L16/d:176, 179
- checkpoints too small: L13/d:62
- non-deterministic nodes: L13/d:63
- stale completion fenced: P/s/stage3.go:4-5, P/README.md:53
- changed payload under existing ID conflicts, new identifier: P/README.md:38, P/API.md:12
- crash injection exits 86 by design: P/API.md:3, P/README.md:51

## Q&A (qa, 6)
- None replays from checkpoint: L16/d:152
- completed v4 after crash: P/README.md:51. version increments: P/s/stage2.go:15, P/s/stage3.go:9, 18
- at least once: P/README.md:72
- immutable receipt idempotent: P/README.md:72
- Reclaim when running and now >= LeaseUntil: P/s/stage3.go:12-13
- supervisor, swarm, hierarchical: L13/d:56-58

## Tips (tips, 6)
- name the nodes: L16/d:172
- hoist plan and budget: L16/d:173
- prefer linear chains: L13/d:64
- approvals on edge into side-effecting node: L16/d:176
- no NFS: P/README.md:70
- new store for repeatable crash: P/README.md:40
