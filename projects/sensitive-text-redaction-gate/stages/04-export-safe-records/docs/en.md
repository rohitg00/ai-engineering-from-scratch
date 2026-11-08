# Export redacted records and bounded evidence

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

Accept up to ten thousand records with exactly id and text. IDs must match [A-Za-z0-9_-]{1,64} and be unique. Return schema_version=1, records, ledger, totals and scope. The provided CLI writes JSONL and a receipt without raw input text. The HTML escapes redacted content and lets a reviewer expand the offset ledger.

```text
process(records, literals=()) -> dict; render_html(report) -> str
```

## Work through one example

```python
process([{'id': 'case-1', 'text': 'a@example.test'}])['totals']['spans']
```

Expected value:

```text
1
```

The final tests invoke the CLI on a held-out address, load redacted.jsonl in a second consumer, and assert no supported detector remains. They also inspect every exported file for the original address. A malformed JSONL file must fail without echoing its contents.

## Interactive Lab

```figure
pj-sensitive-text-redaction-gate-4
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Reject extra metadata rather than silently copying an unscanned field to output. A non-sensitive ID is a caller obligation; syntax validation cannot prove that an ID is public.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --stage 4 --path learning-artifacts/sensitive-text-redaction-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 4 --solution --strict`.

## Use it and extend it

At the final stage, run the CLI from your workspace and inspect every exported artifact:

```bash
cd learning-artifacts/sensitive-text-redaction-gate
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

The three authored notes produce four replacement spans: two emails, one IPv4 address and one explicit case identifier. The third note survives unchanged. The exported JSONL can be read directly by a dataset or prompt preprocessing step; keep receipt.json beside it to show the exact supported scope.

This is a bounded pattern-based redactor, not a general PII detector or an anonymization guarantee. It recognizes ASCII email syntax, valid dotted IPv4 addresses and case-sensitive literal strings. Names, phone numbers, IPv6, obfuscated addresses and encoded secrets can remain. IDs must be non-sensitive. Review remaining text before sharing it. The HTML contains only redacted text and offset receipts, never the original values or the configured literal dictionary.
