# Publish evidence and reviewable investigation drafts

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Feedback Theme Board: group product feedback with inspectable phrase evidence, count distinct sources, and export local issue drafts.

Your public contract is `draftIssue(theme); renderBoard(board)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

The board should make a source quote easier to inspect than a headline count. Render evidence, source labels and offsets beside each theme; include unmatched records and duplicate counts. Escape all user text, including source labels.

Export one local Markdown investigation draft per theme. A draft proposes reproducing the reported friction; it must not turn a keyword match into a confirmed defect. An optional model can suggest theme rules through --suggest, but its output is saved separately and passes the same schema validation before a person adopts it.

| Artifact | Next action |
|---|---|
| board.html | Review exact quotes |
| board.json | Compare runs in another tool |
| first-run.md | Edit an investigation draft locally |
| themes.proposed.json | Review optional model suggestions |

## Predict before running

Inspect the first-run count beside its two quotes. Explain why the draft says one source label rather than two customers.

```figure
pj-feedback-theme-board-4
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py feedback-theme-board --init my-feedback-theme-board
python3 scripts/project_test.py feedback-theme-board --stage 4 --path my-feedback-theme-board --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Render from the same board object you export as JSON.
2. Keep issue writing local and explicit.
3. Keep model-suggested configuration separate from accepted configuration.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 4. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-feedback-theme-board
node cli.ts sample.jsonl themes.json output
```

The final artifact is a portable evidence board, JSON summary and unsent Markdown investigation drafts. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Feed board.json to a prioritization tool and require it to retain the original evidence links.

Scope: The baseline matches explicit word phrases, not semantic sentiment or truth. Distinct source labels are not verified people or market size. Optional model suggestions produce a separate proposed configuration that must be reviewed before use; nothing posts to an issue tracker.

Primary reference: [JSON text interchange, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). The implementation and exercise data are original teaching examples.
