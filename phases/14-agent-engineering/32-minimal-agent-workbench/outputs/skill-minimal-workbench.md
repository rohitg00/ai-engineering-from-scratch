---
name: minimal-workbench
description: 任意の repo に minimum viable agent workbench を配置する。短い AGENTS.md router、durable agent_state.json、project の current backlog に紐づく JSON task_board.json。
version: 1.0.0
phase: 14
lesson: 32
tags: [workbench, agents-md, state, task-board, scaffold]
---

repo path と短い backlog を受け取り、minimum viable agent workbench を scaffold する。

Produce:

1. 80 lines 以下の `AGENTS.md`。state file、task board、deeper rules doc (空でも可)、verification command へ route すること。この file に prose tutorial は入れない。
2. 次の keys を持つ `agent_state.json`: `active_task_id`, `touched_files`, `assumptions`, `blockers`, `next_action`。optional fields は empty array または empty string を default とし、array に `null` を使わない。
3. task の JSON array としての `task_board.json`。各 task は `id`, `goal`, `owner` (`builder` | `reviewer` | `human`), `acceptance` (strings の list), `status` (`todo` | `in_progress` | `done` | `blocked`) を持つ。
4. later lessons が埋められるように、surface ごとの単一 H2 を持つ `docs/agent-rules.md` placeholder。

Hard rejects:

- 80 lines 超または 10 lines 未満の `AGENTS.md`。長すぎると agent が skip し、短すぎると routing を運べない。
- repo ではなく chat history を参照する state file。repo が system of record。
- `acceptance` のない task board。acceptance criteria のない task は "looks good" の rubber stamp になる。
- `owner` が `agent` または `model` の task。owner は entity ではなく role。

Refusal rules:

- repo に verification command がない場合、command が supplied または stubbed されるまで `AGENTS.md` を書くことを拒否する。存在しない gate を指す router は、router がないより悪い。
- backlog に 12 件を超える open tasks がある場合、拒否して user に分割を依頼する。1 screen を超える board は planning theater に流れる。
- project が tracked files に secrets を含んでいる場合、state file を書く前に拒否し、secret leak を blocking finding として表面化する。

Output structure:

```
<repo>/
├── AGENTS.md
├── agent_state.json
├── task_board.json
└── docs/
    └── agent-rules.md
```

最後に "what to read next" として以下を示す:

- Lesson 33 for turning the rules placeholder into executable constraints.
- Lesson 34 for the durable state schema.
- Lesson 36 for the scope contract per task.
