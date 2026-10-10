# Enforce shared retry budgets and server delays

> Bound aggregate attempts across clients, not just each individual request.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Add a shared cap on scheduled retries to Replay. A mutex-protected Budget uses Take to admit at most the declared number across live goroutines. Parse Retry-After as nonnegative integer seconds or an HTTP date. A past HTTP date yields zero delay.

## Worked example

Twenty clients may each allow four attempts, but a shared budget of 12 bounds the simulation at 32 total calls. Admission is deterministic by schedule order in simulation and depends on goroutine order in live mode.

```figure
pj-retry-storm-lab-3
```

## Implement the contract

`NewBudget(n int)*Budget`; `(*Budget).Take()bool`; `ServerDelay(value string,now time.Time)(time.Duration,error)`. Invalid values fail. A live server delay above MaxMS stops the request rather than retrying earlier than instructed.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --stage 3 --path /tmp/retry-storm-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

A process-local mutex is not a fleet-wide distributed budget. Define a central admission protocol before sharing this policy across processes.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
