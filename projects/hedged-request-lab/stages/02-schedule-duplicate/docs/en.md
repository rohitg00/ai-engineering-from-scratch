# Schedule delayed duplicate attempts

> Launch a second safe read only when the delay expires before a winner.

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Start the primary request and a delay timer. A valid primary result before the timer prevents the hedge. Otherwise launch at most one secondary. Apply a two-second ceiling under the parent context and perform GET only.

## Worked example

The local primary sleeps 80ms; the secondary sleeps 5ms. A 10ms hedge delay can return around 15ms while creating a second service request. Exact observed times depend on the local scheduler.

```figure
pj-hedged-request-lab-2
```

## Implement the contract

`Hedged(parent context.Context,client *http.Client,endpoints []string,delay time.Duration)(Receipt,error)`. Accept one or two endpoints and delay from 0 to 1 second. Receipt contains launched attempt count, winner index, value and winner latency. Response validation is provided scaffolding for this stage.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py hedged-request-lab --init /tmp/hedged-request-lab-work
python3 scripts/project_test.py hedged-request-lab --stage 2 --path /tmp/hedged-request-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Set delay above the primary latency. The second endpoint should receive no request, and launched must remain one.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
