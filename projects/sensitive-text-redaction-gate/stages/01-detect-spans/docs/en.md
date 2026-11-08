# Detect bounded sensitive spans

> Remove bounded sensitive-text patterns before records enter a model pipeline.

**Type:** Build
**Languages:** Python
**Prerequisites:** Basic Python dictionaries and lists
**Time:** ~120 minutes

## Learning Objectives

- Implement the public function contract and reject unsupported input.
- Predict the worked example before running the tool.
- Explain the failure cases with stored evidence.
- Reuse the output in the next pipeline stage.

## What you build

Return start/end Python character offsets and kind EMAIL, IPV4 or LITERAL. End is exclusive. Results sort by start, end, kind. Never return matched text. The detector validates dotted addresses with ipaddress rather than accepting every four-number string. Literal matching is case-sensitive and includes overlapping matches.

```text
detect(text, literals=()) -> list[dict]
```

## Work through one example

```python
detect('To a@example.test!')
```

Expected value:

```text
[{'start': 3, 'end': 17, 'kind': 'EMAIL'}]
```

A character offset differs from a UTF-8 byte offset: the tree emoji in `🌳 a@example.test` takes one Python character, so the email starts at 2. Validate the text and literal limits before scanning. Try `999.1.1.1`; a regex candidate must still pass address validation.

## Interactive Lab

```figure
pj-sensitive-text-redaction-gate-1
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Invalid text type, text over one million characters, empty literals and more than one hundred literals raise ValueError. Stop with ValueError when a record exceeds 10,000 matches; never return partial redaction. Match the starting boundary against the full email-prefix alphabet. Otherwise a punctuation-only string can force a new scan at every character.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --stage 1 --path learning-artifacts/sensitive-text-redaction-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 1 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/sensitive-text-redaction-gate
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
