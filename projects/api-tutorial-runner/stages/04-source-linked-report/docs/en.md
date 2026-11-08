# Export source-linked failures and correction proposals

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Produce portable test evidence and require a reviewed correction rather than silently editing a tutorial.

## Public contract

```typescript
exportResults(steps,receipts):{junit,html,corrections}; acceptedCorrections(receipts,value):{id,line,proposal}[]
```

JUnit has one testcase per receipt with failure/skipped elements. HTML shows source lines and real request/response evidence. Correction draft `{id,line,issue,proposal:"",approved:false}` is editable in the browser. Versioned corrections reimport only when id,line,issue match the current failing receipt, approved is boolean and an approved proposal is nonempty.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The report exports 3 testcases with 1 failure and 1 skip. Write a proposed correction changing bookName to title, review it, download corrections.json and reimport it. The source tutorial itself stays unchanged until an author applies a patch.

```figure
pj-api-tutorial-runner-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py api-tutorial-runner --init my-api-tutorial-runner
python3 scripts/project_test.py api-tutorial-runner --stage 4 --path my-api-tutorial-runner --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

The report CLI exits zero after successfully writing a report even if examples fail; inspect results.json/JUnit. No correction changes the tutorial automatically.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-api-tutorial-runner
node cli.ts sample.json output
```

Replayable request manifest, JUnit results and annotated tutorial HTML. Open `output/report.html` and inspect the machine-readable companion files. After downloading corrections.json, run `node cli.ts sample.json reviewed-output --corrections corrections.json`. accepted-corrections.json contains only reviewed proposals tied to current failures.

## Extend it

Connect accepted-corrections.json to a review-only documentation patch generator.

Scope: The default fixture is an actual temporary loopback HTTP server serving authored JSON routes. It is a tutorial checker, not a production load tester. External test endpoints require the --allow-network flag. Responses are JSON; redirects, streaming protocols, credentials and full OpenAPI validation are outside this subset.
