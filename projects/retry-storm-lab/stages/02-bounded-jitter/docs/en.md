# Compare bounded backoff and jitter

> Spread scheduled retries with a reproducible client-specific sequence.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Backoff before retry n starts at BaseMS and doubles until MaxMS. Jitter selects a deterministic integer in [0,cap] from the client, attempt and seed. This arithmetic sequence is an educational reproducibility device, not a cryptographic random generator.

## Worked example

Base 10 and cap 25 produce 10,20,25,25 without jitter. With jitter enabled, each client can schedule a different delay. A zero delay is valid full jitter and may amplify the same time bucket.

```figure
pj-retry-storm-lab-2
```

## Implement the contract

`Delay(p Policy,client,attempt int) int`, with attempt numbered from 1 for the first retry wait. Mix ((client+1)*1103515245 + attempt*12345 + seed) using uint64: xor with x>>16, multiply by 2246822519, xor with x>>13, then take modulo (cap+1). `Validate` rejects invalid bounds.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --stage 2 --path /tmp/retry-storm-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Run the same seed twice and compare exact timelines, then change the seed. Report distributions across seeds before drawing performance conclusions.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
