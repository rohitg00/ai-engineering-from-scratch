# Extract explicit requests from an authored tutorial

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Identify executable tutorial examples without guessing intent from arbitrary code blocks.

## Public contract

```typescript
extractRequests(markdown:string):RequestStep[]
```

Only fences whose opening line is exactly ```request are parsed as JSON. Each request has id,method,path,status and optional body,assert,capture. Methods GET/POST/PUT/PATCH/DELETE; path begins with one slash; expected status 100..599. Assert maps dotted response paths to expected JSON values. Capture maps variable names to `{path,type:string|number|boolean}`. Return line as the 1-based opening fence line. IDs unique; maximum 20 steps.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

A request fence opening at tutorial line 5 retains line:5 in the manifest. A surrounding prose paragraph or ordinary json fence does not run as a request.

```figure
pj-api-tutorial-runner-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py api-tutorial-runner --init my-api-tutorial-runner
python3 scripts/project_test.py api-tutorial-runner --stage 1 --path my-api-tutorial-runner --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Ignore ordinary JSON fences. Reject malformed or unclosed explicit blocks, unsupported methods and paths that can escape the chosen origin.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-api-tutorial-runner
node cli.ts sample.json output
```

Replayable request manifest, JUnit results and annotated tutorial HTML. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add source filename alongside line for multi-file tutorials.

Scope: The default fixture is an actual temporary loopback HTTP server serving authored JSON routes. It is a tutorial checker, not a production load tester. External test endpoints require the --allow-network flag. Responses are JSON; redirects, streaming protocols, credentials and full OpenAPI validation are outside this subset.
