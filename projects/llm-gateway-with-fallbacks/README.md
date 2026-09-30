# LLM Gateway With Fallbacks

Build a local non-streaming HTTP proxy with real provider fallback, per-provider environment credentials, response limits, and one overall deadline. Verify the complete wire path with loopback servers.

Go 1.22 or later, standard library only. Four stages, about eight hours. You need structs, slices, callbacks, errors and basic JSON; the stage prerequisites link to the relevant curriculum. Start with the offline example before connecting a provider.

## Build it

1. [Validate provider endpoints](stages/01-validate-provider-endpoints/docs/en.md)
2. [Classify failures without retrying everything](stages/02-classify-failures-without-retrying-everything/docs/en.md)
3. [Send one bounded HTTP request](stages/03-send-one-bounded-http-request/docs/en.md)
4. [Route with a total-attempt budget](stages/04-route-with-a-total-attempt-budget/docs/en.md)

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --init /tmp/llm-gateway-with-fallbacks-work
python3 scripts/project_test.py llm-gateway-with-fallbacks --stage 1 --path /tmp/llm-gateway-with-fallbacks-work --strict
python3 scripts/project_test.py llm-gateway-with-fallbacks --all --solution --strict
```

The clean starter fails clearly until you implement the stages. All adapters and fixtures are copied into the learner workspace. The grader calls your workspace functions, including the functions used by the CLI.

## Run the actual HTTP demo

```bash
cd projects/llm-gateway-with-fallbacks/solution
go run .
```

The demo starts three temporary loopback HTTP servers: a primary returning 503, a backup returning a chat-completions response, and the gateway. An actual request crosses the proxy and both providers, prints `HTTP 200`, `ATTEMPTS 2`, `PROVIDER backup`, then closes every server. Provider answers are authored fixtures; the wire path is real.

## Connect your own providers

Copy `fixtures/providers.example.json` to `/tmp/providers.json` and replace the URLs and model identifiers. Each provider has a unique `name`, `url`, optional `model` override, and optional `key_env` naming an existing environment variable. Omit `key_env` for a local service that needs no key. The example names placeholder models and does not assume they are installed.

```bash
go run . --config /tmp/providers.json --request fixtures/request.json
go run . --config /tmp/providers.json --listen 127.0.0.1:8088
```

The first command sends your request file and prints a JSON route trace. The second runs a local proxy until you stop it. In another terminal:

```bash
curl --fail-with-body http://127.0.0.1:8088/v1/chat/completions -H 'Content-Type: application/json' --data-binary @fixtures/request.json
```

Existing clients can use `http://127.0.0.1:8088/v1` as their base URL, with streaming disabled. Caller Authorization headers are discarded; each provider receives only its own configured environment credential. No caller headers are copied. Missing configured keys fail before the first upstream call. Query strings, URL credentials and redirects are refused.

## Contract and limits

`max_attempts` is 1 through 16; each provider is visited at most once. `max_response_bytes` is 1 through 16 MiB. `timeout_ms` is 1 through 5000 and applies to the whole route, including all fallback attempts. Incoming request JSON is limited to one MiB and must be a non-streaming object. Both standalone `Attempt` and `Route` add a five-second deadline when the caller provides none; earlier deadlines still win. Custom transports must honor Go context cancellation.

2xx completes, 429 and 5xx permit fallback, and other HTTP statuses stop. Response overflow stops. A transport error may permit fallback, but cancellation stops immediately. This policy does not repeat calls to the same provider, wait for `Retry-After`, or promise that cancelled generations were not billed.

Successful proxy responses retain the upstream status/body and add `X-Gateway-Attempts` and `X-Gateway-Provider`. Failures become a local 502, or 504 for cancellation, without echoing upstream error bodies. CLI receipts contain endpoint, status, duration and failure kind. The library interfaces are `Endpoints`, `ClassifyStatus`, `Attempt`, `Route`, `RouteConfigured` and `GatewayHandler`.

The listening server binds only to loopback and has no client authentication, streaming, shared rate limit, persistent trace store or high-availability claim. Use it as a local integration component. Real loopback tests cover provider authentication separation, overall deadlines, redirects, request/response limits and model rewriting. No external account is needed for grading.

## Completion evidence

```bash
python3 scripts/project_test.py llm-gateway-with-fallbacks --all --path /tmp/llm-gateway-with-fallbacks-work --strict --report /tmp/llm-gateway-with-fallbacks-result.json
```

Reference passes do not grant a learner certificate. Local reports are unsigned, self-reported evidence. Browser figures calculate from editable inputs; they illustrate the algorithms and do not issue model calls.

[Go HTTP package](https://pkg.go.dev/net/http), [Go contexts](https://pkg.go.dev/context), and [JSON decoding](https://pkg.go.dev/encoding/json) describe the standard-library boundaries used here. All sample scenarios and exercises are original.
