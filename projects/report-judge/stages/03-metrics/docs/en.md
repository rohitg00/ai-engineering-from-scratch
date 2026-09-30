# Report precision coverage and source recall

**Stage 3 of 4.** Python. Plan about 2 hours.

Keep metrics separate before combining them. Precision measures published support, source recall measures expected evidence selection, and fact coverage measures whether key phrases appear. An empty report has zero precision, preventing abstention from looking perfectly accurate.

```figure
pj-report-judge-3
```

## Implementation boundary

```python
def score_report(text,evidence,expected_sources=(),facts=()):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://www.rfc-editor.org/rfc/rfc8259).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 2](../../02-support/docs/en.md) first.

An empty report has no evidence and scores zero. Recall and fact coverage require labels; without labels they are unavailable, rather than automatically perfect. Only supported claims earn source recall or coverage.

```text
empty claims -> score 0, state no_evidence
3 lexical matches, no reference labels -> recall null, coverage null
score is computed only from available metrics
```

## Build and inspect

Track supported claims once and derive all supported-evidence metrics from that collection. Do not let a dangling citation inflate source recall.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py report-judge --stage 3 --path learning-artifacts/report-judge
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why can a 100 lexical-match score coexist with unavailable recall?
