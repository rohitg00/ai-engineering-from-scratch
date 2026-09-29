# Route with a total-attempt budget

> Route the caller body while keeping credentials private.

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Prerequisites:** Stages 1 through 3. Read [Token Counter and Cost Meter](../../../../token-counter-and-cost-meter/README.md) before adding usage accounting.
**Time:** ~2 hours

## What you build

Implement `Route` by walking validated endpoints once, charging attempts before calling `Attempt`, and recording status, elapsed milliseconds and failure kind. Stop on success, a terminal status, response overflow, cancellation or the call ceiling. Give the entire route a five-second maximum even without a caller deadline.

Provided `RouteConfigured` composes your route with stricter operator settings: 1 through 5000 milliseconds, response ceiling and named providers. Its transport creates a provider-specific Authorization header from `key_env` and may rewrite `model`. `GatewayHandler` copies the JSON body only; caller headers never become provider credentials. When the supplied transport rewrites a model, Body, GetBody and ContentLength must describe the same bytes. Go may replay a request after a zero-byte write failure on a reused connection; that replay must retain the configured model. Redirects remain disabled.

## Worked example

Primary takes 35 ms and returns 503. Under a 65 ms total deadline, backup receives roughly 30 ms, not another 65 ms. When that shared context expires, return `State=cancelled`, the attempts made so far and the context error.

For a successful proxy request, the response carries `X-Gateway-Attempts: 2` and `X-Gateway-Provider: backup`. The body is the actual backup response. Errors use local 502 responses, or 504 for cancellation, without echoing provider error bodies. The CLI emits the fuller trace for operator inspection.

```figure
pj-llm-gateway-with-fallbacks-4
```

## Implement the contract

```go
func Route(ctx context.Context, client *http.Client, providers []string, payload string, maxAttempts int, maxBytes int64) (Outcome, error)
```

Check `ctx.Err()` immediately after a failed attempt, including the last provider. Otherwise a timeout may be mislabeled as ordinary exhaustion. Missing configured environment variables should fail before any provider receives a request. The integration tests use separate local servers to observe both credential headers.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --init /tmp/llm-gateway-with-fallbacks-work
python3 scripts/project_test.py llm-gateway-with-fallbacks --stage 4 --path /tmp/llm-gateway-with-fallbacks-work --strict
```

Your implementation belongs in `stage4.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Run `go run .` from the completed workspace: it starts a primary, backup and proxy on temporary loopback ports and closes them after one request. For your own endpoints, copy `fixtures/providers.example.json`, replace model names, then use `go run . --config /tmp/providers.json --request fixtures/request.json` or `--listen 127.0.0.1:8088`. The server is local, non-streaming and unauthenticated; it is not a public deployment template.

[Go standard-library reference](https://pkg.go.dev/context). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
