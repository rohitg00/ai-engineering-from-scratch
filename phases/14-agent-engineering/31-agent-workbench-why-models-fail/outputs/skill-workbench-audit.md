---
name: workbench-audit
description: agent 作業を始める前に repo の 7 つの agent workbench surface を監査し、missing、partial、healthy を報告する。
version: 1.0.0
phase: 14
lesson: 31
tags: [workbench, audit, reliability, agent-engineering]
---

repository path と、その中で実行される agent product を受け取り、7 つの workbench surface を監査して readiness report を作成する。

7 つの surface:

1. Instructions: agent が最初に読む root file (例: `AGENTS.md`)。短く、より深い rules へ route する。
2. State: task、touched files、blockers、next action を記録する durable, machine-readable file。
3. Scope: task ごとの contract。allowed files、forbidden files、acceptance criteria、rollback plan を列挙する。
4. Feedback: command、stdout、stderr、exit code を捕捉し、結果を loop に戻す runner。
5. Verification: tests、lint、type-check、smoke run を実行し、acceptance criteria を確認する gate。
6. Review: 別ロールによる second pass。builder は自分の work を採点できない。
7. Handoff: 何を変更し、なぜ変更し、何が残り、次の最善 action は何かを要約する artifact。

Produce:

- surface ごとの score: 0 missing、1 partial、2 healthy。各 score を観測した file または process に結び付ける。
- leverage 順の優先度 3 つ: 最初に追加すると最も多くの failure mode を除去する missing surface はどれか。
- machine-readable な `workbench_audit.json` report と、human-readable な `workbench_audit.md` summary。
- 最も弱い surface 用の starter patch: score を 0 から 1 へ動かす最小の file change。

Hard rejects:

- file path または process reference のない "Healthy" score。evidence のない audit は腐る。
- 1 つにまとめた "agent config" surface。surface をまとめると、task が壊れたときにどれが失敗したのか隠れてしまう。
- tests が遅いことを理由に verification を skip すること。verification が workbench にないと、builder が自分の宿題を採点する。

Refusal rules:

- repo に test command がまったくない場合、verification score を拒否し、blocking finding として表面化する。
- repo に version control history がない場合、handoff score を拒否し、blocking finding として表面化する。
- agent product が root または unrestricted file access で動く場合、sandbox または write list が定義されるまで scope score を拒否する。

Output structure:

```
workbench-audit/
├── workbench_audit.json
├── workbench_audit.md
├── patches/
│   └── <weakest-surface>.patch
└── README.md
```

最後に "what to read next" として以下を示す:

- Lesson 32 for the minimal repo layout.
- Lesson 33 for the instructions surface in depth.
- Lesson 38 for the verification gate.
