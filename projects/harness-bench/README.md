# Harness Bench

Compare baseline, error-retry and evidence policies against the same ordered cases and model configuration. Count actual calls, reject incomparable receipts, replay finite recordings or call a configured HTTP model.

Go 1.22 or later, standard library only. Four stages, about eight hours. You need structs, slices, callbacks, errors and basic JSON; the stage prerequisites link to the relevant curriculum. Start with the offline example before connecting a provider.

## Build it

1. [Load unseen benchmark cases](stages/01-load-unseen-benchmark-cases/docs/en.md)
2. [Define exactly what a correct answer means](stages/02-define-exactly-what-a-correct-answer-means/docs/en.md)
3. [Run a harness under a call budget](stages/03-run-a-harness-under-a-call-budget/docs/en.md)
4. [Compare runs on equal denominators](stages/04-compare-runs-on-equal-denominators/docs/en.md)

```bash
python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work
python3 scripts/project_test.py harness-bench --stage 1 --path /tmp/harness-bench-work --strict
python3 scripts/project_test.py harness-bench --all --solution --strict
```

The clean starter fails clearly until you implement the stages. All adapters and fixtures are copied into the learner workspace. The grader calls your workspace functions, including the functions used by the CLI.

## Run your own comparison

```bash
cd projects/harness-bench/solution
go run . --cases fixtures/orchard-cases.json --recording fixtures/orchard-recording.json --budget 4 --out /tmp/orchard-runs.json
```

The authored Orchard scenario exposes three different failure modes: stale expiry knowledge, a transient restore error, and a price that is absent. One shared response recording produces baseline 1/3 with three calls, error-retry 2/3 with four, and evidence 3/3 with three. These deliberately constructed answers teach policy behavior; they are not model-performance evidence.

Create a JSON array with `ID`, `Prompt`, `Expected` and optional `Evidence` string arrays. Files are limited to one MiB and 1000 cases. Scoring ignores case and whitespace, while preserving punctuation, numbers and units. It does not judge semantic equivalence or normalize composed Unicode accents.

Recordings declare `kind` (`authored_fixture` or `recorded_provider`), `model`, generation `settings`, and `responses`: exact prompts mapped to finite arrays of `{answer, error?}`. Each policy starts a fresh cursor over the same recording. Missing prompts or exhausted arrays produce counted errors. Evidence requests append `\n\nEvidence:\n` plus newline-joined evidence. The example recording contains those exact requests.

```bash
go run . --cases fixtures/orchard-cases.json --endpoint http://127.0.0.1:11434/v1/chat/completions --model YOUR_LOCAL_MODEL --budget 4 --timeout 30s --out /tmp/live-runs.json
```

For a remote HTTPS service, provide its full chat-completions endpoint and `--key-env YOUR_PROVIDER_KEY_VARIABLE`. The key must already exist in your environment; it is not written into receipts. `--temperature` defaults to 0 and `--max-tokens` to 128. HTTP requests are capped at ten seconds within the per-policy deadline; response bodies are limited to one MiB. Redirects and query-bearing endpoints are rejected. External providers may charge for every attempted request.

## Read the receipt

The JSON contains model configuration, dataset/configuration SHA-256 digests and each call's prompt, answer, error flag and score. Dataset serialization ignores JSON whitespace and key order while preserving execution order. Model configuration includes endpoint or recording digest, model identifier and generation settings. The leaderboard requires matching receipts and call budgets, so a same-sized replacement dataset cannot silently join a comparison.

`Attempted` counts cases; `Calls` counts actual model invocations; `Errors` counts final case failures. Unattempted cases remain in `Total`. Error retries never inspect the expected answer. Exact score is applied only after a response.

The library entry points are `Cases`, `Correct`, `EvaluatePolicy` and `Leaderboard`. `Evaluate` preserves the simple baseline callback API and uses a legacy model label; callers needing configuration evidence should use `EvaluatePolicy` with an explicit receipt. Manually constructed legacy results without receipts retain counter-only ranking for compatibility. Receipts are unsigned local evidence, not proof of a remote model's identity or a controlled statistical experiment. Live policies run sequentially; repeat and rotate order when estimating variance.

## Completion evidence

```bash
python3 scripts/project_test.py harness-bench --all --path /tmp/harness-bench-work --strict --report /tmp/harness-bench-result.json
```

Reference passes do not grant a learner certificate. Local reports are unsigned, self-reported evidence. Browser figures calculate from editable inputs; they illustrate the algorithms and do not issue model calls.

[Go HTTP package](https://pkg.go.dev/net/http), [Go contexts](https://pkg.go.dev/context), and [JSON decoding](https://pkg.go.dev/encoding/json) describe the standard-library boundaries used here. All sample scenarios and exercises are original.
