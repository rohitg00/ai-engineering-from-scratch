# Validate provider endpoints

> Treat the provider list as trusted configuration.

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Prerequisites:** Go structs, slices, errors and basic HTTP requests. Read [structured outputs](../../../../../phases/11-llm-engineering/03-structured-outputs/docs/en.md) for strict JSON contracts.
**Time:** ~2 hours

## What you build

Implement `Endpoints(values)` before opening a connection. Allow HTTPS, plus HTTP on exactly `localhost`, `127.0.0.1` or `::1` for local services. Reject userinfo, fragments, queries, line breaks, missing hosts and other schemes. Remove exact duplicates while preserving provider order.

The CLI configuration contains provider names, URLs, optional model overrides and credential environment-variable names. It never accepts a credential value. Rejecting query strings keeps bearer keys out of endpoint URLs and traces; this small gateway does not support query-based API versions.

## Worked example

Input order is primary `https://primary.example/v1/chat/completions`, primary again, then `http://127.0.0.1:11434/v1/chat/completions`. The validated list has two entries in that order. A primary failure can therefore reach the local fallback.

Change the final host to `local-model.example` while keeping HTTP. Reject the entire list. The word “local” in a hostname does not prove a loopback connection. A URL containing `user:password@host` is rejected before a request can be sent.

```figure
pj-llm-gateway-with-fallbacks-1
```

## Implement the contract

```go
func Endpoints(values []string) ([]string, error)
```

Parse with `net/url`, inspect `Hostname`, and maintain a separate seen set. Do not sort endpoints: order is the fallback policy. The server accepts configuration from the operator, never from incoming JSON request fields.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --init /tmp/llm-gateway-with-fallbacks-work
python3 scripts/project_test.py llm-gateway-with-fallbacks --stage 1 --path /tmp/llm-gateway-with-fallbacks-work --strict
```

Your implementation belongs in `stage1.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Use the controls to add a duplicate or change a URL scheme. Why must `https://a.example?api_key=...` fail? Endpoint validation does not establish that a configured HTTPS service is trustworthy; the operator owns that selection.

[Go standard-library reference](https://pkg.go.dev/context). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
