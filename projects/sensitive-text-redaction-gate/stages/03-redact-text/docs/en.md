# Replace spans without leaking source values

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

Compose detect and merge_spans. Walk left to right, append untouched text and the literal marker [REDACTED], then append the final suffix. Return text, spans and redacted_characters. Each receipt has index, start, end and kinds. Offsets always refer to the original string.

```text
redact(text, literals=()) -> dict
```

## Work through one example

```python
redact('banana', ['ana'])['text']
```

Expected value:

```text
'b[REDACTED]'
```

Keep the original cursor separate from the output length: replacement markers can be longer than the removed text. Sum original interval lengths for redacted_characters. A no-match record is unchanged with zero spans. Preserve emoji and accents outside selected spans.

## Interactive Lab

```figure
pj-sensitive-text-redaction-gate-3
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Do not hash short private values into public receipts: those hashes can still support dictionary guessing. Do not include source substrings in exceptions or receipts.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --stage 3 --path learning-artifacts/sensitive-text-redaction-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 3 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/sensitive-text-redaction-gate
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
