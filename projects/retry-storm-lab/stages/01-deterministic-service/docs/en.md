# Model concurrent failures with a deterministic clock

> Make aggregate retry load visible in a discrete event replay.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Replay clients that all begin at time zero. The service returns 503 before failUntil or when the count at the exact millisecond exceeds capacity. Sort scheduled attempts by time then client ID. Success ends that client. The supplied fixed Delay scaffold supports this stage; richer backoff comes next.

## Worked example

Three clients, capacity 2 and failUntil=0 produce two initial successes and one 503. With one allowed attempt, the report has three calls and two successes. Initial calls are never counted as retries.

```figure
pj-retry-storm-lab-1
```

## Implement the contract

`Replay(clients,failUntil,capacity int,p Policy,budget int)(Report,error)`. Policy fields are BaseMS, MaxMS, Attempts, Jitter, Seed. Version-1 report has mode, clients, calls, successes, retries and timeline. Limits: 0..1000 clients, 1..10 attempts, positive capacity, nonnegative time and budget.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --stage 1 --path /tmp/retry-storm-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Compare the busiest exact-millisecond bucket with total amplification. These answer different questions about load.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
