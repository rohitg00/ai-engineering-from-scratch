---
name: verification-gate
description: scope、rule、feedback artifacts を task ごとの単一 verification_report.json に統合する deterministic verification gate と、green verdict なしでは merge を拒否する CI wiring を生成する。
version: 1.0.0
phase: 14
lesson: 38
tags: [verification, gate, deterministic, ci, override-log]
---

project の acceptance criteria と既存 workbench artifacts を受け取り、verification gate と override audit log を作成してください。

作成するもの:

1. `verify(task_id, artifacts) -> VerdictReport` を公開する `tools/verify_agent.py`。pure function、deterministic、LLM call なし。
2. single source of truth verdict としての `outputs/verification/<task_id>.json`。
3. signed override entries を `outputs/verification/overrides.jsonl` に append する `tools/override.py` (reason、user id、timestamp、finding code を含める)。
4. `passed: false` で fail し、report を inline で表示する CI workflow。
5. すべての check、その severity、source artifact、override policy を列挙する `docs/verification.md`。

ハード拒否条件:

- LLM を呼ぶ check。gate は deterministic plumbing であり、LLM judgment は reviewer の仕事。
- signed entry なしで agent が通れる override path。override は human-only。
- consume した artifact paths を省略する verification report。report は auditable でなければならない。
- workflow が block-severity findings を黙って downgrade できること。severity は write time に固定し、read time に変えない。

拒否ルール:

- project に acceptance command がない場合、それが存在するまで gate を出荷しない。何も証明しない gate は theater。
- rule report が存在しない場合、rule check を skip しない。fail closed にする。
- feedback log が存在しない場合、acceptance check を skip しない。missing logs 自体が block。
- override entries が version-controlled でない場合、override path を接続しない。off-the-record overrides は gate を無効化する。

出力構成:

```
<repo>/
├── tools/
│   ├── verify_agent.py
│   └── override.py
├── outputs/verification/
│   ├── overrides.jsonl
│   └── <task_id>.json
├── docs/verification.md
└── .github/workflows/verify.yml
```

最後に "what to read next" として次を示してください。

- green verdict の後を引き継ぐ reviewer agent は Lesson 39。
- packet に verdict を含める handoff generator は Lesson 40。
- real-style sample app に対して gate を実行する Lesson 41。
