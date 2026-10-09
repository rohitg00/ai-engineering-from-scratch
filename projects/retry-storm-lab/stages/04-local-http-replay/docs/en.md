# Replay against a local HTTP service

> Exercise actual HTTP requests and verify the exported counters independently.

**Type:** Build
**Languages:** Go, TypeScript
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Fetch performs bounded GET attempts with context cancellation, retryable statuses 429/502/503/504 and a shared budget. Local runs concurrent clients against a loopback server that returns 503 once per client then succeeds. TypeScript independently reconstructs counters and millisecond buckets from the exported trace.

## Worked example

Run local-http with twenty clients and budget 12. The fixture receives twenty initial requests and at most twelve retry requests. The report separates this measured loopback run from the deterministic simulation.

```figure
pj-retry-storm-lab-4
```

## Implement the contract

`Fetch(ctx,*http.Client,url,id,Policy,*Budget)([]Attempt,error)`; `Local(Policy,clients,budget)(Report,error)`. TypeScript `analyze(text)` checks contiguous attempt numbers, client bounds, success terminality and counter consistency before computing amplification.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --stage 4 --path /tmp/retry-storm-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

A millisecond bucket in live mode uses elapsed time since each client started, so treat the peak as approximate aligned-client evidence. Local results do not establish any external service capacity.

[HTTP Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after) and [Go HTTP](https://pkg.go.dev/net/http).
