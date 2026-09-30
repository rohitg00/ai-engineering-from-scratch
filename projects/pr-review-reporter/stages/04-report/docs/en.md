# Publish a local escaped report

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Render a self-contained report with source locations, quoted evidence, severity and message. Escape source text as carefully as prose: a diff can contain executable HTML. Keep external publication outside the tool. The CLI writes review.html locally and prints a machine-readable summary for automation.

The boundary for this stage is `escapeHTML, render`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The CLI reads a supplied patch, validates candidates, merges duplicates and writes matching locations into review.json, review.html and review.sarif. The diff SHA-256 binds the report to the exact patch bytes.

```figure
pj-pr-review-reporter-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `escapeHTML, render` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Treat source snippets as untrusted HTML. Use an argument array for Git mode and keep all outputs local; a review artifact should be inspectable before any public posting.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py pr-review-reporter --init learning-artifacts/pr-review-reporter`. Then grade cumulatively:

```bash
python3 scripts/project_test.py pr-review-reporter --stage 4 --path learning-artifacts/pr-review-reporter --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/pr-review-reporter
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

## Investigate the failure boundary

Create an independent held-out patch with a quoted filename and disabled TLS. Verify its SARIF region.startLine against git diff, then change the patch and observe the fingerprint change.

Four lexical detectors are narrow review candidates, not an exploit verdict. Binary and combined diffs are outside scope. Quoted Git paths are decoded before validating traversal and anchoring. No remote PR comment is posted.


## References

[Git diff format](https://git-scm.com/docs/diff-format)
[Python subprocess and JSON](https://docs.python.org/3/library/json.html)
