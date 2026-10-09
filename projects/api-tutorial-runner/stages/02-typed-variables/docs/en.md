# Resolve typed variables across steps

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Make dependencies explicit and preserve captured primitive types.

## Public contract

```typescript
resolveValue(value:unknown,variables:Record<string,string|number|boolean>):unknown; captureVariables(body,declarations,previous?):Record<string,string|number|boolean>
```

Exact string {{name}} resolves to the primitive value; embedded placeholders interpolate as strings. Walk nested arrays/objects without mutating input. Dotted capture paths read own properties only, including array indices. Require exact declared primitive type; names cannot overwrite earlier variables. Unknown variables throw.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

POST /loans returns `{id:41}`. Capture loanId with type number yields `{loanId:41}`; JSON `{"loan":"{{loanId}}"}` resolves to `{"loan":41}`, while request path becomes /loans/41.

```figure
pj-api-tutorial-runner-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py api-tutorial-runner --init my-api-tutorial-runner
python3 scripts/project_test.py api-tutorial-runner --stage 2 --path my-api-tutorial-runner --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Do not evaluate expressions. Captured number 41 stays a number in a JSON body, while its path substitution is encoded text.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-api-tutorial-runner
node cli.ts sample.json output
```

Replayable request manifest, JUnit results and annotated tutorial HTML. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add a declared nullable type with explicit handling rather than loose coercion.

Scope: The default fixture is an actual temporary loopback HTTP server serving authored JSON routes. It is a tutorial checker, not a production load tester. External test endpoints require the --allow-network flag. Responses are JSON; redirects, streaming protocols, credentials and full OpenAPI validation are outside this subset.
