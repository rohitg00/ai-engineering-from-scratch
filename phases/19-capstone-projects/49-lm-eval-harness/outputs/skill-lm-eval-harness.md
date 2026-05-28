---
name: lm-eval-harness
description: JSONL task spec、5 つの metric、差し替え可能な adapter、leaderboard JSON 出力を持つ最小 language model evaluation harness。
version: 1.0.0
phase: 19
lesson: 49
tags: [evaluation, metrics, leaderboard, harness]
---

## 使う場面

2 つの model、checkpoint、prompt template を固定 task set で比較し、時間を追って監視したいときに使う。

## Task spec

1 example 1 JSONL line:

```json
{"id": "ex-001", "prompt": "...", "targets": ["..."], "metric": "exact_match", "extras": {}}
```

1 file の全 example は同じ metric を共有する。file name が task name である。

## Metrics

| Metric | Signature | 用途 |
|--------|-----------|------|
| exact_match | lower + whitespace 正規化後に equality | arithmetic、factoid answer |
| substring_contains | 正規化後 prediction に target が含まれる | anchor word を持つ free-form generation |
| multiple_choice | first letter match | A/B/C/D 形式の question |
| rouge_l | tokenized text の LCS F1 | summary、paraphrase |
| code_exec | prediction の `f` を io_pairs で実行 | code generation |

すべての metric は [0.0, 1.0] の float を返す。task score は平均である。

## Adapter

```python
class Adapter(Protocol):
    name: str
    def generate(self, prompts: list[str]) -> list[str]: ...
```

adapter は唯一の model-specific code である。

## Leaderboard JSON

schema string、timestamp、per-task score と latency、overall mean を含める。run を比較するときは per-example record も入れ、prediction-level regression を見えるようにする。

## Failure modes

- metric が [0, 1] の外を返す: overall score が解釈不能になる。
- 1 task file に複数 metric を混ぜる: assertion が発火する。
- restricted namespace なしの `code_exec`: 任意コード実行になる。
- schema string がない: downstream dashboard の format evolution が壊れる。
