---
name: scope-contract
description: 許可/禁止 glob、受け入れ条件、rollback plan を備えた task ごとのスコープ契約と、すべての agent diff で実行する CI-ready な glob-aware checker を生成する。
version: 1.0.0
phase: 14
lesson: 36
tags: [scope, contract, globs, diff-check, ci]
---

タスク説明と repo layout が与えられたら、スコープ契約と diff-aware checker を作成してください。

生成するもの:

1. タスク用の `scope_contract.json`。field は `task_id`, `goal`, `allowed_files` (globs), `forbidden_files` (globs), `acceptance_criteria`, `rollback_plan`, `approvals_required`。
2. `tools/scope_check.py`。contract path と touched file の一覧を受け取り、`ScopeReport` を返し、違反があれば non-zero exit する。
3. checker を merge diff に対して実行する CI step (`.github/workflows/scope-check.yml` または同等)。
4. 契約を変更履歴と一緒に出荷するための `outputs/scope/closed/<task_id>.json` archive convention。

Hard rejects:

- `forbidden_files` のない契約。negative space は契約の一部です。
- code directory に raw path を列挙し、glob を使っていない契約。refactor で raw path は一晩で無効になります。
- 空、または「see runbook」だけの `rollback_plan` field。具体的に書いてください。
- 「case by case」と書かれた approval。approval boundary は列挙可能でなければなりません。

Refusal rules:

- タスク説明が repo の対象領域を制約していない場合、説明だけから `allowed_files` を作ることを拒否してください。タスクが属する directory を尋ねてください。
- repo に test command がない場合、command が提供または stub されるまで `acceptance_criteria` の追加を拒否してください。検証できない契約は願望です。
- agent runtime が approval boundary を尊重できない場合 (human-in-the-loop がない場合)、出荷前に gap を明示してください。approval-required action への scope creep が主な failure になります。

Output structure:

```
<repo>/
├── scope_contract.json
├── outputs/scope/closed/
│   └── T-XXX.json
├── tools/
│   └── scope_check.py
└── .github/
    └── workflows/
        └── scope-check.yml
```

最後に "what to read next" を置き、次を指してください。

- Lesson 37: 実行した command を契約に紐づける runtime feedback。
- Lesson 38: scope report を consume する verification gate。
- Lesson 39: closed contract archive を audit する reviewer agent。
