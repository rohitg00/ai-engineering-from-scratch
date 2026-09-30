# Match phrases while preserving original spans

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Feedback Theme Board: group product feedback with inspectable phrase evidence, count distinct sources, and export local issue drafts.

Your public contract is `findEvidence(row, phrase)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.ts`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Tokenize the original text while retaining each token’s start and end. Normalize token values for matching, but derive the quote from the original string. Consecutive token comparison avoids substring mistakes such as matching slow inside slowdown.

This stage establishes why a rule matched; it does not establish the feedback is factually correct or that its sentiment is negative. A negated sentence can still contain the phrase. That limitation should remain visible so later users can review evidence rather than trust a category label blindly.

| Text | Phrase | Result |
|---|---|---|
| Search results show old pages. | old pages | Exact source quote |
| The old homepage changed. | old pages | No match |
| No more old pages appear. | old pages | Match requiring interpretation |

## Predict before running

Add an emoji before the matching phrase. Verify JavaScript slice still reproduces the quote using UTF-16 offsets.

```figure
pj-feedback-theme-board-2
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py feedback-theme-board --init my-feedback-theme-board
python3 scripts/project_test.py feedback-theme-board --stage 2 --path my-feedback-theme-board --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Keep match.index for each original token.
2. Compare normalized token values, not normalized whole-text offsets.
3. Return the smallest matched span.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 2. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-feedback-theme-board
node cli.ts sample.jsonl themes.json output
```

The final artifact is a portable evidence board, JSON summary and unsent Markdown investigation drafts. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Add a review flag for negation as a separate heuristic and measure its false positives.

Scope: The baseline matches explicit word phrases, not semantic sentiment or truth. Distinct source labels are not verified people or market size. Optional model suggestions produce a separate proposed configuration that must be reviewed before use; nothing posts to an issue tracker.

Primary reference: [JSON text interchange, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). The implementation and exercise data are original teaching examples.
