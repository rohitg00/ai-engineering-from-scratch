# Export latency and duplicate-work tradeoffs

> Report both faster responses and the extra requests that produced them.

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Run baseline and hedged samples sequentially against the same controlled endpoints. Export distributions, launched call counts, individual hedge receipts and independently measured fixture work. The local fixture deliberately continues sleeping after client cancellation.

## Worked example

Three baseline samples launch three calls; three hedged samples normally launch six. The fixture records all nine started and completed calls, while observed client cancellation is reported separately. Faster winner latency does not erase duplicate work.

```figure
pj-hedged-request-lab-4
```

## Implement the contract

`Compare(samples int,delay time.Duration)(Comparison,error)` runs loopback fixtures. `CompareEndpoints(samples,delay,client,primary,secondary,workCallback)` reuses the runner. Samples must be 1..100. JSON schemaVersion is 1.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py hedged-request-lab --init /tmp/hedged-request-lab-work
python3 scripts/project_test.py hedged-request-lab --stage 4 --path /tmp/hedged-request-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Consume the exported JSON and compute hedgedCalls/baselineCalls. Repeat with several delays to sketch the latency versus work curve; do not extrapolate local endpoints to a remote service.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
