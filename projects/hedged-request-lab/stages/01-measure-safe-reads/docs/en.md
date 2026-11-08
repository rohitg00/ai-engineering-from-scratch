# Measure safe-read latency

> Summarize observed samples without inventing a performance guarantee.

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Summarize nonnegative finite latency samples using nearest-rank percentiles. Keep the sample count and maximum so a tiny experiment does not masquerade as a stable distribution. The library adapter performs GET requests only.

## Worked example

Samples [2,4,10,20,80] have P50=10, P95=80, maximum=80 and sample count 5. Sorting must not mutate the caller's array.

```figure
pj-hedged-request-lab-1
```

## Implement the contract

`Summarize([]float64)(Distribution,error)` returns samples, p50Ms, p95Ms and maxMs. Reject empty, negative, NaN and infinite values. `SafeURL(string)error` accepts HTTP(S) URLs without credentials or fragments.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py hedged-request-lab --init /tmp/hedged-request-lab-work
python3 scripts/project_test.py hedged-request-lab --stage 1 --path /tmp/hedged-request-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Collect repeated controlled runs. Nearest-rank P95 on five points is simply the maximum; it is not a tail estimate for production.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
