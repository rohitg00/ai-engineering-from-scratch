# Review explanations and reading order

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Apply an author review without losing the original graph relationships.

## Public contract

```typescript
reviewGraph(graph: Graph, value?: unknown): {schemaVersion:1;graph:Graph;order:string[];reviewed:boolean}
```

Optional review `{schemaVersion:1,order,reviewed,explanations?:Record<string,string>}` must contain each node once. Known explanations can be replaced with nonempty text; edges stay unchanged. Without review use candidate order and reviewed:false. Return a deep copy.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

A reviewer can choose collect,check,clarify,share and explain the missing-label branch first. The order is a full permutation; a duplicated check cannot replace share.

```figure
pj-diagram-reading-companion-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py diagram-reading-companion --init my-diagram-reading-companion
python3 scripts/project_test.py diagram-reading-companion --stage 3 --path my-diagram-reading-companion --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Do not label an unreviewed order as reviewed. Reject stale IDs and empty explanations.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-diagram-reading-companion
node cli.ts sample.json output
```

A navigable HTML diagram walkthrough and a reviewed graph manifest. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an explanation change record for collaborative review.

Scope: The graph relationships are explicitly authored; the tool does not infer meaning from SVG geometry or claim image understanding. Supported SVG is a safe, constrained drawing subset. Reading order is a reviewable candidate, not a proof of pedagogy.
