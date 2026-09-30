# Define exactly what a correct answer means

> Define the answer contract before seeing the scores.

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Prerequisites:** Stage 1 and string processing. The scorer deliberately uses an exact answer contract.
**Time:** ~2 hours

## What you build

Implement `Correct(actual, expected)` as lowercase plus collapsed whitespace, followed by equality. Empty expected answers never pass. Keep numbers, units and punctuation: an expiry of 15 minutes and 150 minutes have different operational consequences.

This metric is appropriate when prompts request a duration, state or explicit abstention. It does not measure the factual quality of free-form essays.

## Worked example

For `actual = " 15   MINUTES\n"`, split the text into `["15", "MINUTES"]`, join it as `15 MINUTES`, then lowercase it to `15 minutes`. The normalized expected answer is also `15 minutes`, so the case earns one point.

`15 min` fails against `15 minutes`. That is a declared metric limitation, not evidence that the model is wrong. Add accepted variants through a separately specified contract if your application needs them; do not loosen equality after inspecting the winners.

```figure
pj-harness-bench-2
```

## Implement the contract

```go
func Correct(actual, expected string) bool
```

`strings.Fields` handles runs of whitespace. `strings.ToLower` handles Unicode case, but does not compose canonically equivalent accents. Record that boundary rather than claiming semantic or full Unicode normalization.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work
python3 scripts/project_test.py harness-bench --stage 2 --path /tmp/harness-bench-work --strict
```

Your implementation belongs in `stage2.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Test `10 ms` against `100 ms`, and `ready!` against `ready`. Which should pass under this contract? Write the answer before running the scorer. For open-ended answers, use the [Report Judge](../../../../report-judge/README.md) with source evidence instead of this metric.

[Go standard-library reference](https://pkg.go.dev/encoding/json). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
