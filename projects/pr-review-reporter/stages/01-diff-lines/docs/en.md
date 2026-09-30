# Recover new-file line numbers

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Parse hunk headers into old and new counters. Context consumes both counters, deletions consume only the old counter, and additions consume the new counter while producing a reviewable location. Reject truncated hunks and parent-traversing paths. The parser is deliberately for text unified diffs; binary patches and combined merge diffs are outside the contract. Wire Python into TypeScript using execFileSync and stdin, never an interpolated shell command.

The boundary for this stage is `parseDiff`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A hunk starts at new line 10, includes two context rows, deletes three old rows and adds eval(input). The addition belongs to new line 12: deletions never advance the new-file counter.

```figure
pj-pr-review-reporter-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `parseDiff` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

While a hunk has remaining rows, a line beginning +++ is still added content, not a new filename header. Decode Git quoted paths before validating traversal.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py pr-review-reporter --init learning-artifacts/pr-review-reporter`. Then grade cumulatively:

```bash
python3 scripts/project_test.py pr-review-reporter --stage 1 --path learning-artifacts/pr-review-reporter --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/pr-review-reporter
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

## Investigate the failure boundary

Use a filename containing a space and an added line whose source starts with ++. Both must retain their exact evidence without confusing parser states.




## References

[Git diff format](https://git-scm.com/docs/diff-format)
[Python subprocess and JSON](https://docs.python.org/3/library/json.html)
