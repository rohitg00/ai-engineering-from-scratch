# Classify failures without retrying everything

> Separate a repairable outage from a broken request.

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Prerequisites:** Stage 1 and HTTP status-code classes.
**Time:** ~2 hours

## What you build

Implement `ClassifyStatus(status)` with three outcomes. A 2xx response succeeds; 429 and 5xx permit fallback; all other valid codes are terminal. Integers outside 100 through 599 are invalid.

A 401 usually means the configured credential needs repair. Sending the same request to several providers can hide that mistake, so this project stops. A 503 indicates that a provider cannot serve the request right now, so another configured provider may help.

## Worked example

Follow statuses `[503, 200]`: classify the first as `retry`, then the second as `success`. Follow `[401, 200]`: the 401 is `terminal` and the second provider is never contacted. A 307 is also terminal because the request layer refuses redirects.

This routing policy visits each provider at most once. It does not sleep for `Retry-After`, retry the same endpoint, or promise that a timed-out generation was never billed.

```figure
pj-llm-gateway-with-fallbacks-2
```

## Implement the contract

```go
func ClassifyStatus(status int) (string, error)
```

Validate the numeric range first, then test success, then the two retry conditions. Do not use `status >= 400` as the retry rule: it would include malformed requests and authentication failures.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --init /tmp/llm-gateway-with-fallbacks-work
python3 scripts/project_test.py llm-gateway-with-fallbacks --stage 2 --path /tmp/llm-gateway-with-fallbacks-work --strict
```

Your implementation belongs in `stage2.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Predict the outcomes for 204, 301, 408, 429, 500 and 600. In this policy, 408 is terminal. If you choose to retry it in a future extension, write the new contract and side-effect assumptions before changing the implementation.

[Go standard-library reference](https://pkg.go.dev/context). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
