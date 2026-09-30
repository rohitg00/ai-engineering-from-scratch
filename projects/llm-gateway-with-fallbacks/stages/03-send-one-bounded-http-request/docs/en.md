# Send one bounded HTTP request

> Bound one request in both bytes and time.

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Prerequisites:** Stages 1 and 2. Understand Go contexts and `io.Reader` ownership.
**Time:** ~2 hours

## What you build

Implement `Attempt(ctx, client, endpoint, payload, maxBytes)`. Send a JSON POST using a copy of the caller's HTTP client, disable redirects, and always close the response body. Refuse nil clients, request bodies over one MiB and response limits outside 1 through 16 MiB.

Add a five-second context deadline even when the caller passes `context.Background()`. An earlier caller deadline still wins. The standard HTTP transport observes cancellation while connecting and reading the body.

## Worked example

With response limit 5 and body `0123456789`, read at most six bytes. Seeing six establishes overflow, so return `ErrLimit` without retaining the entire response. With exactly five bytes, return the body and status.

A 307 response contains a `Location` header. Return that response for terminal classification; do not send another request to the new host. The original client's `CheckRedirect` field remains unchanged after the call.

```figure
pj-llm-gateway-with-fallbacks-3
```

## Implement the contract

```go
func Attempt(ctx context.Context, client *http.Client, endpoint, payload string, maxBytes int64) (Reply, error)
```

Use `io.LimitReader(body, maxBytes+1)` so exact-fit and overflow remain distinguishable. A timeout on each request alone is insufficient for the final route: stage 4 also shares one deadline across all attempts. A custom `RoundTripper` must honor context cancellation just as the standard transport does.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --init /tmp/llm-gateway-with-fallbacks-work
python3 scripts/project_test.py llm-gateway-with-fallbacks --stage 3 --path /tmp/llm-gateway-with-fallbacks-work --strict
```

Your implementation belongs in `stage3.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Test an exactly full body, a body one byte too large, and a redirect to another local test server. The redirected server's request count must remain zero. After implementing all stages, run the actual loopback demo with `go run .` in your workspace.

[Go standard-library reference](https://pkg.go.dev/context). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
