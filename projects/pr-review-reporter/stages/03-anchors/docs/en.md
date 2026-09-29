# Verify and merge findings

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Require an existing added-line location and a nonempty exact source substring for every candidate. Reject fabricated files, deleted-line locations, empty quotes and invalid severity values. Merge findings by file, line and rule; keep the stronger severity when reviewers disagree. The quote gate establishes location support, not the truth of a security claim, which still needs review.

The boundary for this stage is `verify, merge`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A model suggestion cites the right file but quotes a deleted line. That text is absent from the added-line evidence and must be rejected. Two supported reports for the same(file,line,rule) merge using the stronger severity.

```figure
pj-pr-review-reporter-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `verify, merge` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Separate accepted and rejected collections so debugging a review does not require trusting every suggestion. Treat supplied JSON as unknown data: require an outer array, then reject nulls, arrays and non-object entries before accessing fields. Require string file, quote, rule and message fields, a positive integer line, a supported severity, and nonempty trimmed quote, rule and message. Preserve malformed entries in `rejected`; valid neighbors must still reach rendering and SARIF export.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py pr-review-reporter --init learning-artifacts/pr-review-reporter`. Then grade cumulatively:

```bash
python3 scripts/project_test.py pr-review-reporter --stage 3 --path learning-artifacts/pr-review-reporter --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/pr-review-reporter
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

## Investigate the failure boundary

Change only the line number in a valid candidate. Confirm that an identical quote elsewhere does not silently move the finding.




## References

[Git diff format](https://git-scm.com/docs/diff-format)
[Python subprocess and JSON](https://docs.python.org/3/library/json.html)
