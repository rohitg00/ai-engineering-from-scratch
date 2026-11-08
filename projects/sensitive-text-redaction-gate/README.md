# Sensitive Text Redaction Gate

Detect ASCII email patterns, valid IPv4 addresses and explicit literal identifiers. Merge overlapping spans, replace their union without exposing original values in receipts, and export redacted JSONL plus an inspectable HTML ledger.

Python 3.12 or later. No model credentials or third-party dependencies are required.

## Build your version

From the repository root:

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --init learning-artifacts/sensitive-text-redaction-gate
python3 scripts/project_test.py sensitive-text-redaction-gate --stage 1 --path learning-artifacts/sensitive-text-redaction-gate --strict
```

The first run intentionally fails until you implement stage one. The supplied CLI and HTML renderer are scaffolding; they call your functions. Implement each stage without replacing your workspace with the reference.

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --all --path learning-artifacts/sensitive-text-redaction-gate --strict --report completion.json
cd learning-artifacts/sensitive-text-redaction-gate
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

## Run the reference

```bash
python3 scripts/project_test.py sensitive-text-redaction-gate --all --solution --strict
cd projects/sensitive-text-redaction-gate/solution
python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output
```

Open `demo-output/review.html` locally. Replace the sample input path with your own JSONL to use the tool beyond the demo. The [API contract](API.md) defines the accepted input and output shapes.

## Expected result and integration

The three authored notes produce four replacement spans: two emails, one IPv4 address and one explicit case identifier. The third note survives unchanged. The exported JSONL can be read directly by a dataset or prompt preprocessing step; keep receipt.json beside it to show the exact supported scope.

The exported artifacts are `redacted.jsonl, receipt.json and review.html`. The supplied fixtures are authored examples. Test-level held-out cases use different values and malformed inputs; a successful demo alone does not qualify as completion.

## Scope

This is a bounded pattern-based redactor, not a general PII detector or an anonymization guarantee. It recognizes ASCII email syntax, valid dotted IPv4 addresses and case-sensitive literal strings. Names, phone numbers, IPv6, obfuscated addresses and encoded secrets can remain. IDs must be non-sensitive. Review remaining text before sharing it. The HTML contains only redacted text and offset receipts, never the original values or the configured literal dictionary.

## Stages

1. [Detect bounded sensitive spans](stages/01-detect-spans/docs/en.md)
2. [Merge complete overlap unions](stages/02-merge-overlaps/docs/en.md)
3. [Replace spans without leaking source values](stages/03-redact-text/docs/en.md)
4. [Export redacted records and bounded evidence](stages/04-export-safe-records/docs/en.md)

## Primary references

- [Python regular expressions](https://docs.python.org/3/library/re.html)
- [Python IP address validation](https://docs.python.org/3/library/ipaddress.html)
