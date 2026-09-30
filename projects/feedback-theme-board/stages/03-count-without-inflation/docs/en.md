# Count evidence without inflating source support

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Feedback Theme Board: group product feedback with inspectable phrase evidence, count distinct sources, and export local issue drafts.

Your public contract is `buildBoard(rows, themes)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Repeated records and repeated sources cause different counting errors. Deduplicate the same normalized text from the same source, retaining the duplicate relationship for inspection. Then count unique source labels within each theme. Two distinct records from interview-a still provide one distinct source label.

A record can match multiple themes. Therefore theme totals need not add to the number of input records. Keep unmatched feedback in a visible queue; dropping it would bias the board toward the categories you already expected to find.

| Sample theme | Matched records | Distinct source labels |
|---|---|---|
| First useful run | 2 | 1 |
| Stale search | 2 | 2 |
| Search latency | 1 | 1 |

## Predict before running

Copy f-1 under a new ID with the same source, then under a different source. Explain how both counters should change.

```figure
pj-feedback-theme-board-3
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py feedback-theme-board --init my-feedback-theme-board
python3 scripts/project_test.py feedback-theme-board --stage 3 --path my-feedback-theme-board --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Use a fingerprint of source plus normalized text for duplicate detection.
2. Use a set of source labels for each theme.
3. Preserve unmatched and duplicate records in the result.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 3. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-feedback-theme-board
node cli.ts sample.jsonl themes.json output
```

The final artifact is a portable evidence board, JSON summary and unsent Markdown investigation drafts. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Compare two theme configurations and report which records changed membership.

Scope: The baseline matches explicit word phrases, not semantic sentiment or truth. Distinct source labels are not verified people or market size. Optional model suggestions produce a separate proposed configuration that must be reviewed before use; nothing posts to an issue tracker.

Primary reference: [JSON text interchange, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). The implementation and exercise data are original teaching examples.
