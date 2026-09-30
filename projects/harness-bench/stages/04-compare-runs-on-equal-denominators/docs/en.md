# Compare runs on equal denominators

> Prove the runs are comparable before ranking them.

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Prerequisites:** Stages 1 through 3. Read [Prompt Regression Tester](../../../../prompt-regression-tester/README.md) for paired output comparisons.
**Time:** ~2 hours

## What you build

Implement `Leaderboard` so it validates results before sorting. Require equal totals and unique harness names. Receipt-bearing results must have the same ordered dataset SHA-256, model-configuration SHA-256 and call budget. Reject missing receipts mixed into a receipt-bearing comparison.

`Fingerprint` serializes typed values before hashing. Dataset key order and whitespace disappear, but case order, prompts, expected answers and evidence remain part of the receipt. The model receipt includes adapter, model ID, generation settings, endpoint when live, and the full recording digest when replaying.

## Worked example

The authored Orchard recording yields baseline `1/3` with three calls, retry `2/3` with four, and evidence `3/3` with three. Those are deliberately constructed responses that demonstrate the mechanism; they do not rank real models.

Now replace the expiry question but keep three cases. Equal denominators still say `3`, while dataset digests differ. Reject that comparison with `ErrConflict`. Changing `max_tokens` from 128 to 256 must also reject a mixed comparison, even if the model name is unchanged.

```figure
pj-harness-bench-4
```

## Implement the contract

```go
func Leaderboard(results []Result) (string, error)
```

Validate counters before sorting a copy: `Correct + Errors <= Attempted <= Total`, and receipt-bearing runs must satisfy `Attempted <= Calls <= CallBudget`. Rank by correct answers, then fewer final errors, then name. Legacy manually constructed results without any receipts retain the original counter-only API; use `EvaluatePolicy` for recorded or live comparisons.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work
python3 scripts/project_test.py harness-bench --stage 4 --path /tmp/harness-bench-work --strict
```

Your implementation belongs in `stage4.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Run `go run . --cases fixtures/orchard-cases.json --recording fixtures/orchard-recording.json --out /tmp/orchard-runs.json` in your completed workspace. Inspect one trace from each policy. The HTTP adapter accepts a full chat-completions endpoint, `--model`, `--key-env`, `--temperature` and `--max-tokens`; the README has the command. Repeated live runs are needed to estimate variance, and these unsigned receipts do not attest that a remote model stayed fixed.

[Go standard-library reference](https://pkg.go.dev/encoding/json). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
