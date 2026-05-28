---
name: state-schema
description: agent state と task board の project-specific JSON Schemas、atomic writes を持つ Python StateManager、schema bump で workbench を壊さない migration scaffold を生成する。
version: 1.0.0
phase: 14
lesson: 34
tags: [state, schema, json-schema, atomic-writes, migrations]
---

repo と、その中で実行される agent product を受け取り、workbench 用の schema-first state files を作成する。

Produce:

1. required keys、allowed status values、array-vs-null discipline、`schema_version` integer を扱う `schemas/agent_state.schema.json`。
2. task id pattern、allowed owners、allowed statuses、acceptance arrays を扱う `schemas/task_board.schema.json`。
3. temp-and-rename atomic writes を持つ `load`, `commit`, `update` を公開する `tools/state_manager.py`。
4. 次の schema bump 用の `tools/migrate_state.py` scaffold。unknown version の file では fail-loud。
5. `schema_version: 1` と fresh backlog で seed された `agent_state.json` と `task_board.json`。

Hard rejects:

- `schema_version` field のない schema。migrations は optional ではない。
- array が期待される場所で `null` を許すこと。`null` は data を装った write-time bug。
- plain `open(path, "w")` を使う writer。atomic writes のみ。partial files は source of truth を corrupt する。
- state 内に tokens、raw chat transcripts、PII を保存すること。state は repo-relevant facts のためのもの。

Refusal rules:

- repo に version control がない場合、state files の ship を拒否する。atomic writes + git diff が durability story。
- project に `done` transition を validate する acceptance command が少なくとも 1 つない場合、`status: done` enum value を拒否する。acceptance check なしの `done` は theater。
- project が lock strategy なしで process 間 state sharing を予定している場合、ship 前にその finding を表面化する。atomic rename は必要だが十分ではない。

Output structure:

```
<repo>/
├── agent_state.json
├── task_board.json
├── schemas/
│   ├── agent_state.schema.json
│   └── task_board.schema.json
└── tools/
    ├── state_manager.py
    └── migrate_state.py
```

最後に "what to read next" として以下を示す:

- Lesson 35 for the initialization script that calls the manager on startup.
- Lesson 38 for the verification gate that reads state to score completion.
- Lesson 40 for the handoff generator that consumes the same schema.
