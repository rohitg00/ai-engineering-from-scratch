---
name: rule-set-builder
description: project owner に interview し、既存の prose instructions を 5 つの operational categories に分類し、versioned agent-rules.md と Python checker stub を出力する。
version: 1.0.0
phase: 14
lesson: 33
tags: [rules, instructions, constraints, checker, workbench]
---

repo と既存の prose instructions (`AGENTS.md`, `CONTRIBUTING.md`, onboarding docs) を受け取り、workbench が実行できる 5-category rule set を作成する。

5 categories:

1. `startup` — work を始める前に true であるべきこと。
2. `forbidden` — 絶対に起きてはいけないこと。
3. `definition_of_done` — task complete を証明するもの。
4. `uncertainty` — agent が確信できないときにすること。
5. `approval` — human sign-off が必要なもの。

Produce:

1. rule ごとに 1 つの `##` heading を持つ `docs/agent-rules.md`。各 rule は `category`, `check`, one-line description を持つ。
2. `check` ごとに 1 method を公開する `RuleChecker` class を持つ `tools/rule_checker.py`。各 method は `TurnTrace` dataclass を受け取り `bool` を返す。
3. rules を load し、trace に対して checker を実行し、`rule_report.json` を出力する `tools/rule_report.py` runner。
4. migration notes file: どの prose line がどの rule になり、どれが aspirational として落とされ、なぜ落とされたか。

Hard rejects:

- `check` field のない rules。aspirational-only rules は workbench rule set ではなく onboarding docs に置く。
- 単一の "be careful" rule。category と check を指定するか削除する。
- LLM calls が必要な checks。rule checks は毎 turn 実行できるよう deterministic かつ cheap でなければならない。
- 200 lines を超える rule files。`agent-rules.{startup,forbidden,done,uncertainty,approval}.md` のように category ごとに分割し、parent index から route する。

Refusal rules:

- agent product が `TurnTrace` を供給できない場合 (instrumentation がない)、少なくとも `read_state_file`, `edited_files`, `tests_exit_code` が記録されるまで checker wiring を拒否する。
- 既存 instructions の大半が aspirational (>50%) の場合、rules を出力する前にその finding を表面化する。rule set が薄く見えるのは正しい。
- 1 件の過去 incident を理由に rule を追加する場合、future review が必要性を判断できるよう incident id を attach する。

Output structure:

```
<repo>/
├── docs/
│   └── agent-rules.md
├── tools/
│   ├── rule_checker.py
│   └── rule_report.py
└── docs/migration-notes.md
```

最後に "what to read next" として以下を示す:

- Lesson 36 for per-task scope contracts that extend the forbidden category.
- Lesson 38 for verification gates that consume the rule report.
- Lesson 39 for the reviewer agent that scores rule compliance.
