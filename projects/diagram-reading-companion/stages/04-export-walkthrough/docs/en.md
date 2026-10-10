# Export the navigable walkthrough and graph data

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Connect focusable node buttons to the authored picture and export a reusable review.

## Public contract

```typescript
renderWalkthrough(svg:string, review:ReturnType<typeof reviewGraph>):string
```

The standalone page includes the validated SVG, per-node explanation editor, Previous/Next controls, an editable order, branch/cycle evidence and graph-review.json download. That download is accepted by reviewGraph and by the CLI third argument.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Edit the explanation for clarify, mark the order reviewed and download graph-review.json. Rerun the CLI with that file and inspect graph.json to see reviewed:true and the revised text.

```figure
pj-diagram-reading-companion-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py diagram-reading-companion --init my-diagram-reading-companion
python3 scripts/project_test.py diagram-reading-companion --stage 4 --path my-diagram-reading-companion --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Use safe element IDs already validated at import. Text is inserted with textContent and JSON must escape script delimiters.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-diagram-reading-companion
node cli.ts sample.json output
```

A navigable HTML diagram walkthrough and a reviewed graph manifest. Open `output/report.html` and inspect the machine-readable companion files. Run `node cli.ts sample.json reviewed-output graph-review.json` after editing the page. graph.json records reviewed status, revised explanation text and exact order.

## Extend it

Add read-aloud descriptions using browser accessibility APIs.

Scope: The graph relationships are explicitly authored; the tool does not infer meaning from SVG geometry or claim image understanding. Supported SVG is a safe, constrained drawing subset. Reading order is a reviewable candidate, not a proof of pedagogy.
