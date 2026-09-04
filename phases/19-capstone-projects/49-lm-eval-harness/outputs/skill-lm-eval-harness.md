---
name: lm-eval-harness
description: Minimal language model evaluation harness with JSONL task spec, five metrics, swappable adapter, and leaderboard JSON output.
version: 1.0.0
phase: 19
lesson: 49
tags: [evaluation, metrics, leaderboard, harness]
---

## When to use

Compare two models, two checkpoints, or two prompt templates against a fixed set of tasks. Anything that ships and that you need to monitor over time.

## Task spec

One JSONL line per example:

```json
{"id": "ex-001", "prompt": "...", "targets": ["..."], "metric": "exact_match", "extras": {}}
```

All examples in a file share a metric. The file name is the task name.

## Metrics

| Metric | Signature | Use for |
|--------|-----------|---------|
| exact_match | normalize lower + whitespace, equality | Arithmetic, factoid answers |
| substring_contains | target must appear in normalized prediction | Free-form generation with anchor words |
| multiple_choice | first letter match | A/B/C/D style questions |
| rouge_l | LCS F1 over tokenized text | Summary, paraphrase |
| code_exec | run prediction's `f` on io_pairs, count matches | Code generation |

All metrics return float in [0.0, 1.0]. Task score is the mean.

## Adapter

```python
class Adapter(Protocol):
    name: str
    def generate(self, prompts: list[str]) -> list[str]: ...
```

The adapter is the only model-specific code.

## Leaderboard JSON

Schema string, timestamp, per-task scores and latency, overall mean. Include per-example records when comparing runs so prediction-level regressions are visible.

## Failure modes

- Metric returns outside [0, 1]: overall score becomes uninterpretable.
- Mixed metrics in one task file: assertion fires; keep one metric per file.
- code_exec without restricted namespace: arbitrary code execution.
- No schema string: format evolution breaks downstream dashboards.
