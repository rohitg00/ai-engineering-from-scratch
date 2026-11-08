# Retry Storm Lab

Help SDK authors choose retry behavior when many clients fail together. Replay concurrent clients against a deterministic service model, compare bounded backoff and jitter with a shared retry budget, then run the same policy against a local HTTP fixture. Export amplification and recovery timelines with a reusable client policy.

Standard libraries only. Four stages, approximately eight hours. Go, TypeScript implementations are exercised by the grader.

## Build it

1. [Model concurrent failures with a deterministic clock](stages/01-deterministic-service/docs/en.md)
2. [Compare bounded backoff and jitter](stages/02-bounded-jitter/docs/en.md)
3. [Enforce shared retry budgets and server delays](stages/03-shared-budget/docs/en.md)
4. [Replay against a local HTTP service](stages/04-local-http-replay/docs/en.md)

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --stage 1 --path /tmp/retry-storm-lab-work --strict
python3 scripts/project_test.py retry-storm-lab --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run controlled comparisons

```bash
cd projects/retry-storm-lab/solution
go run . --clients 20 --budget 60 --jitter=false --out /tmp/synchronized.json
go run . --clients 20 --budget 60 --jitter=true --seed 7 --out /tmp/jittered.json
go run . --clients 20 --budget 12 --seed 7 --out /tmp/retry.json
node --experimental-strip-types cli.ts /tmp/retry.json /tmp/amplification.json
go run . --local-http --clients 20 --budget 12 --out /tmp/retry-wire.json
node --experimental-strip-types cli.ts /tmp/retry-wire.json
python3 demo.py
```

Use --base-ms, --max-ms and --attempts to set policy bounds. Simulation inputs --fail-until-ms and --capacity change the failure window and per-millisecond capacity. --jitter=false preserves synchronized exponential waits; --jitter=true applies seeded spreading.

The simulator is a discrete, exact-millisecond capacity model. The real loopback fixture returns one 503 per client and then 200; it does not model an external service's capacity. JSON mode distinguishes the two. TypeScript consumes the Go receipt, verifies all counters and exports an amplification timeline.

Reuse the Go `Fetch` client with your context, bounded http.Client and URL. It performs GET only, returns each observed attempt and does not retry transport errors or nonlisted statuses. Server Retry-After above the policy cap ends the request. Redirect behavior and connection limits belong to the supplied HTTP client. Cancellation limits waiting; it does not prove upstream work stopped. The default Local adapter sets a two-second per-client deadline.

The budget is in-process and shared by the fixture's clients. It never claims transactional rollback or coordination across processes. Live peaks align each client's elapsed clock, while simulation peaks share one exact clock. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after) specifies Retry-After.

## Completion evidence

```bash
python3 scripts/project_test.py retry-storm-lab --all --path /tmp/retry-storm-lab-work --strict --report /tmp/retry-storm-lab-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
