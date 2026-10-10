# Compute branches, cycles and candidate reading order

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Keep branches and cycles visible instead of flattening a graph into a misleading list.

## Public contract

```typescript
analyzeGraph(graph: Graph): Analysis
```

Return `{order,branches,cycles,unreachable}`. Visit roots (zero indegree) in node order, depth-first following edge order; then visit remaining nodes. A branch has more than one outgoing target. Cycles are DFS back-edge paths with repeated start at end, not an enumeration of every simple cycle. Unreachable lists nodes not reached from any zero-indegree root.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

collect -> check branches to share and clarify. Candidate order is collect,check,share,clarify. Adding clarify -> check creates back-edge cycle [check,clarify,check] while preserving every node.

```figure
pj-diagram-reading-companion-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py diagram-reading-companion --init my-diagram-reading-companion
python3 scripts/project_test.py diagram-reading-companion --stage 2 --path my-diagram-reading-companion --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A cycle-only component has no root but still belongs in the candidate order. Mark visited nodes before following edges.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-diagram-reading-companion
node cli.ts sample.json output
```

A navigable HTML diagram walkthrough and a reviewed graph manifest. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Offer breadth-first order as an explicitly reviewed alternative.

Scope: The graph relationships are explicitly authored; the tool does not infer meaning from SVG geometry or claim image understanding. Supported SVG is a safe, constrained drawing subset. Reading order is a reviewable candidate, not a proof of pedagogy.
