---
name: init-script
description: project に interview し、5 つの probes を持つ deterministic init_agent.py と、probe failure 時に agent launch を拒否する CI workflow を出力する。
version: 1.0.0
phase: 14
lesson: 35
tags: [init, probes, ci, workbench, fail-loud]
---

repo、agent product、その dependency surface を受け取り、project-specific init script と CI wiring を作成する。

Produce:

1. 次の probes を持つ `tools/init_agent.py`: runtime version、listed dependencies、test command resolvability、required env vars、state file freshness。
2. script の横に document された `init_report.json` schema。各 probe は `(name, status: pass|warn|fail, detail)` を返す。
3. script を実行し、fail-severity probe があれば agent job を block する `.github/workflows/agent-init.yml` (または equivalent)。
4. agent runtime が各 session 開始前に呼べる `pre-task` hook script。
5. 各 probe、severity、failure の直し方を列挙する `docs/init.md`。

Hard rejects:

- timeout なしで network に call out する probes。init は fast かつ offline-safe でなければならない。
- LLM calls を必要とする probes。init は deterministic plumbing。
- wrapper が swallow する non-zero exit code。fail loud が目的。
- idempotency なしに state に触る probes。連続 2 run は timestamp 以外同一 report を作るべき。

Refusal rules:

- project に test command がない場合、script の ship を拒否する。代わりに gap を workbench audit に追加する。
- env var list に script が print してしまう secrets が含まれる場合、拒否して redaction を強制する。init reports は secrets を運んではならない。
- probe が dry run で 3 seconds を超える場合、ship 前に timing finding を表面化する。長い probes は init を ceremony に変える。

Output structure:

```
<repo>/
├── tools/
│   ├── init_agent.py
│   └── pre_task.sh
├── docs/
│   └── init.md
└── .github/
    └── workflows/
        └── agent-init.yml
```

最後に "what to read next" として以下を示す:

- Lesson 36 for the per-task scope contract that uses the init report's `repo_paths`.
- Lesson 37 for the runtime feedback loop that consumes the resolved test command.
- Lesson 38 for the verification gate that depends on probes passing.
