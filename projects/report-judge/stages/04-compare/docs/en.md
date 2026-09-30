# Compare paired revisions with bootstrap intervals

**Stage 4 of 4.** Python. Plan about 2 hours.

Pair scores by question id, then resample the differences. Pairing controls for the fact that some questions are harder. The interval is descriptive for the supplied split; a tiny dataset does not become reliable because you draw many bootstrap samples. Promotion also rejects any per-question regression.

```figure
pj-report-judge-4
```

## Implementation boundary

```python
def compare(baseline,candidate,seed=7,samples=2000):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://www.rfc-editor.org/rfc/rfc8259).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 3](../../03-metrics/docs/en.md) first.

Compare the same questions before and after a report change. A gain on easy questions can hide one damaging regression; preserve per-question deltas beside the bootstrap interval.

```text
baseline: q1=80,q2=70,q3=90
candidate: q1=85,q2=75,q3=60
deltas: +5,+5,-30; q3 remains a regression
```

## Build and inspect

Resample paired deltas with a deterministic seed. The interval describes this labeled sample, not factual accuracy on every future report.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py report-judge --stage 4 --path learning-artifacts/report-judge
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/report-judge/cli.py projects/report-judge/examples/claims.json --out evidence-audit.json --html evidence-audit.html
```

The judge provides conservative lexical evidence checks. Order, numbers and negation expose some false matches; paraphrases can still be rejected and other false matches remain. Missing recall/coverage labels are null. No automated score proves truth.

## Investigate next

Would adding a second copy of q1 create independent evidence?
