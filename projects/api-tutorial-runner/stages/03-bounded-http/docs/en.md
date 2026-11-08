# Run bounded requests against a test service

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Exercise the actual HTTP wire with bounded local or explicitly opted-in requests.

## Public contract

```typescript
runTutorial(steps:RequestStep[],baseURL:string,options?):Promise<Receipt[]>
```

Base URL must be a bare HTTP(S) origin without credentials. Default permits only literal loopback addresses; allowNetwork:true opts into a supplied test endpoint. Per request timeout defaults to 1500 ms (max 30000), response maxBytes 65536 (max 1048576). URL variables are percent-encoded, redirects rejected, responses parsed as JSON, status and deep-equal assertions checked before captures. Failure stops remaining requests and records skip receipts.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The sample local server returns title, but the read-loan example asserts bookName. create-loan passes, read-loan fails with its source line and response body, and return-loan is skipped without sending DELETE.

```figure
pj-api-tutorial-runner-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py api-tutorial-runner --init my-api-tutorial-runner
python3 scripts/project_test.py api-tutorial-runner --stage 3 --path my-api-tutorial-runner --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Bound the whole response stream, not only connection setup. Never follow a redirect out of the selected origin. Missing fields produce source-linked failures, not fabricated values.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-api-tutorial-runner
node cli.ts sample.json output
```

Replayable request manifest, JUnit results and annotated tutorial HTML. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add explicitly declared retry policy only for idempotent examples.

Scope: The default fixture is an actual temporary loopback HTTP server serving authored JSON routes. It is a tutorial checker, not a production load tester. External test endpoints require the --allow-network flag. Responses are JSON; redirects, streaming protocols, credentials and full OpenAPI validation are outside this subset.
