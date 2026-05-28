---
name: feedback-runner
description: shell command を、決定的な stdout/stderr/exit/duration capture で wrap し、command ごとに JSONL record を永続化し、feedback が欠けているときは agent loop の前進を拒否する。
version: 1.0.0
phase: 14
lesson: 37
tags: [feedback, subprocess, runner, jsonl, loop-control]
---

agent loop 内で shell command を実行する project に対して、feedback runner と、それが書き込む JSONL を作成してください。

作成するもの:

1. `run_with_feedback(command: list[str], agent_note: str, timeout_s: float) -> FeedbackRecord` を公開する `tools/run_with_feedback.py`。
2. workbench 配下の `feedback_record.jsonl` location。1行に1 record。
3. active task の直近 N records を返す `tools/feedback_loader.py`。
4. 成功を主張する前に agent loop が呼ぶ `loop_can_advance(record) -> bool` helper。
5. success path、non-zero exit、timeout、missing binary、決定的な head/tail truncation を cover する tests。

ハード拒否条件:

- runner 内のあらゆる `shell=True`。argv-only にする。
- wall clock や random sampling に依存する truncation。同じ input は同じ record を生成しなければならない。
- `duration_ms` のない records。遅い probe は wedged workbench の最初の兆候。
- unbounded list を返す loader。last N に cap するか paginate する。

拒否ルール:

- project が stdout に secrets を流す場合、redaction step なしでは runner を出荷しない。capture されるはずだった行を表面化する。
- hang し得る command がある場合、default timeout と明示的な override list なしでは出荷しない。
- runner が shared state を持つ worker 内で動く場合、JSONL append 周りの file lock を省略しない。複数 writer は file を壊す。

出力構成:

```
<repo>/
├── feedback_record.jsonl
└── tools/
    ├── run_with_feedback.py
    ├── feedback_loader.py
    └── test_feedback_runner.py
```

最後に "what to read next" として次を示してください。

- record を consume する verification gate は Lesson 38。
- run を採点するときに feedback を読む reviewer agent は Lesson 39。
- feedback が固まった後に telemetry 側へ追加する OTel GenAI conventions は Lesson 23。
