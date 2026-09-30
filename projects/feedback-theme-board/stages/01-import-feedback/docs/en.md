# Import feedback with stable identities

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Feedback Theme Board: group product feedback with inspectable phrase evidence, count distinct sources, and export local issue drafts.

Your public contract is `parseFeedback(text); validateThemes(value)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Each feedback record needs an ID, original text and source label. The ID identifies the record, while the source label identifies the declared origin used for counting. They are not interchangeable: one source can submit multiple records.

Read JSONL one physical line at a time and preserve the line number for errors, even when blank lines are skipped. Validate the theme configuration separately. A theme has a stable ID, a display title and a small list of word phrases. Bounded input sizes keep the teaching workflow predictable.

| Record | Source | Meaning |
|---|---|---|
| f-1 | interview-a | One feedback record |
| f-3 | interview-a | Another record, same source label |
| f-4 | interview-c | Different source label |

## Predict before running

Insert a blank line before malformed JSON and predict the reported physical line. Then duplicate an ID and explain why it must fail.

```figure
pj-feedback-theme-board-1
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py feedback-theme-board --init my-feedback-theme-board
python3 scripts/project_test.py feedback-theme-board --stage 1 --path my-feedback-theme-board --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Count lines before filtering blank ones.
2. Reject duplicate record IDs.
3. Validate bounded phrases before matching any feedback.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 1. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-feedback-theme-board
node cli.ts sample.jsonl themes.json output
```

The final artifact is a portable evidence board, JSON summary and unsent Markdown investigation drafts. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Create a loader for an exported support CSV that produces this exact JSONL contract.

Scope: The baseline matches explicit word phrases, not semantic sentiment or truth. Distinct source labels are not verified people or market size. Optional model suggestions produce a separate proposed configuration that must be reviewed before use; nothing posts to an issue tracker.

Primary reference: [JSON text interchange, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). The implementation and exercise data are original teaching examples.
