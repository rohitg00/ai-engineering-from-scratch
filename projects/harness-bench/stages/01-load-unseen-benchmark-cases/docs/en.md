# Load unseen benchmark cases

> Freeze the cases before comparing policies.

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Prerequisites:** Go structs, slices and JSON decoding. Read [model evaluation](../../../../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md) for the role of held-out examples.
**Time:** ~2 hours

## What you build

An export-link assistant remembers an old 60-minute expiry. Your runbook says 15 minutes. Keep the question, expected answer and permitted evidence in separate fields so you can see exactly what each policy receives.

`Cases(data, max)` accepts a JSON array of `Case{ID, Prompt, Expected, Evidence}`. `Evidence` is an optional string array. Reject unknown fields, duplicate IDs, blank required fields, trailing JSON and more than `max` cases. The input file is limited to one MiB before decoding.

## Worked example

Start with the first record in `fixtures/orchard-cases.json`. Its ID is `orchard-ttl`, expected answer is `15 minutes`, and its evidence is one runbook sentence. After decoding, your state contains one typed record and a seen-ID set containing `orchard-ttl`.

Append a second record with the same ID and a different question. Return `ErrConflict`; do not silently replace the first record. With `max=0`, even the first record exceeds the declared case budget. An empty array can parse, but the final CLI rejects a benchmark with no cases.

```figure
pj-harness-bench-1
```

## Implement the contract

```go
func Cases(data []byte, max int) ([]Case, error)
```

Use `json.Decoder.DisallowUnknownFields`, then perform a second decode and require `io.EOF`. Count records separately from validating their fields. A misspelled `Expected` key must produce an error instead of an empty answer that quietly changes your score.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work
python3 scripts/project_test.py harness-bench --stage 1 --path /tmp/harness-bench-work --strict
```

Your implementation belongs in `stage1.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Why is an ID collision different from two cases with the same expected answer? Try changing JSON whitespace without changing any field: the final dataset receipt should remain identical. Changing case order must change the receipt because a limited budget visits cases in order.

[Go standard-library reference](https://pkg.go.dev/encoding/json). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
