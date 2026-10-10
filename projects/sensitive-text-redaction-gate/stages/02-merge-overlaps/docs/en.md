# Merge complete overlap unions

> Remove bounded sensitive-text patterns before records enter a model pipeline.

**Type:** Build
**Languages:** Python
**Prerequisites:** The previous project stages
**Time:** ~120 minutes

## Learning Objectives

- Implement the public function contract and reject unsupported input.
- Predict the worked example before running the tool.
- Explain the failure cases with stored evidence.
- Reuse the output in the next pipeline stage.

## What you build

Validate each span and sort a copy. Intersecting spans become one union with sorted unique kinds. Adjacent spans remain separate. Do not remove a small nested match and accidentally expose the remainder of a larger one.

```text
merge_spans(spans, text_length) -> list[dict]
```

## Work through one example

```python
merge_spans([{'start': 1, 'end': 4, 'kind': 'LITERAL'}, {'start': 3, 'end': 6, 'kind': 'LITERAL'}], 6)
```

Expected value:

```text
[{'start': 1, 'end': 6, 'kinds': ['LITERAL']}]
```

In `banana`, the literal `ana` occurs at [1,4) and [3,6). The merged interval is [1,6), covering five characters once. Keep a running final interval and extend its end when the next start lies before it. Equality is adjacency, not overlap.

## Interactive Lab

```figure
pj-sensitive-text-redaction-gate-2
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Reject Boolean offsets, negative starts, empty spans, ends past text_length and unsupported kinds. Never mutate the caller spans.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --stage 2 --path learning-artifacts/sensitive-text-redaction-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 2 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/sensitive-text-redaction-gate
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
