# Validate reviewer evidence

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Require a file present in the supplied snapshot, a positive one-based line, an exact nonempty quote, a stable rule id and a severity from one through three. Evidence validation is shared across all reviewers. It protects the aggregation boundary against fabricated locations, but agreement and quoted text still do not prove a finding is correct.

The boundary for this stage is `validateFinding`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A reviewer claims run.ts line 99 contains eval(input), but the supplied snapshot has three lines. Reject it before counting support, even if a second reviewer repeats the same fabricated location.

```figure
pj-multi-agent-code-review-panel-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validateFinding` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Use an own-property file lookup and one-based line conversion. An exact nonempty quote supports location only; it does not prove the severity or causal claim.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py multi-agent-code-review-panel --init learning-artifacts/multi-agent-code-review-panel`. Then grade cumulatively:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --stage 1 --path learning-artifacts/multi-agent-code-review-panel --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/multi-agent-code-review-panel
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

## Investigate the failure boundary

Feed a recorded external finding through the CLI against a changed source snapshot. It must fail the same quote gate as local reviewers.




## References

[AbortController in Node](https://nodejs.org/api/globals.html#class-abortcontroller)
[Node test runner](https://nodejs.org/api/test.html)
