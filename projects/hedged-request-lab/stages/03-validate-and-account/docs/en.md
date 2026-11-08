# Validate winners and account for late work

> A fast error cannot win, and cancellation is an observation rather than a billing guarantee.

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Only HTTP 200 with a nonempty JSON value can win. Read at most 64KiB. After a winner, request cancellation and collect outstanding client observations for at most 100ms. Record unobserved attempts if that grace expires. An attempt arriving after the winner is marked late even when it ended through cancellation.

## Worked example

A primary returning HTTP 500 at 1ms does not beat a secondary returning valid JSON at 15ms. The winner is index 1. The fixture may still complete primary service work after the client has cancelled it.

```figure
pj-hedged-request-lab-3
```

## Implement the contract

`ValidBody(status int,body []byte)(string,error)`; `Read(ctx,client,endpoint,index) Attempt`. Attempt records status, valid, cancelled, late, elapsedMs and optional value/error. Receipt distinguishes cancelRequested and unobserved. No client result can prove service computation stopped.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py hedged-request-lab --init /tmp/hedged-request-lab-work
python3 scripts/project_test.py hedged-request-lab --stage 3 --path /tmp/hedged-request-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Use an endpoint that deliberately ignores request cancellation. Compare client cancelled with the fixture's completed-work counter.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
