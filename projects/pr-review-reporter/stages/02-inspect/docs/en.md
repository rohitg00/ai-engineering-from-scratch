# Generate narrow review candidates

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Build explicit static detectors for dynamic eval, shell exec, disabled TLS validation and empty catch handlers. Inspect only added lines. These patterns produce review candidates rather than proof of exploitable behavior. Keeping rule ids stable makes deduplication possible when a later model reviewer reports the same concern.

The boundary for this stage is `inspect`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The patch adds eval(input) and a comment saying // eval(input) is dangerous. The executable-looking line emits a dynamic-eval candidate; the leading comment is suppressed.

```figure
pj-pr-review-reporter-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `inspect` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Stable rule ids let another reviewer report the same concern without creating duplicate findings. These regexes still lack an AST and can misread strings or multiline constructs; name that limitation in every report.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py pr-review-reporter --init learning-artifacts/pr-review-reporter`. Then grade cumulatively:

```bash
python3 scripts/project_test.py pr-review-reporter --stage 2 --path learning-artifacts/pr-review-reporter --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/pr-review-reporter
node cli.ts --diff samples/change.diff --output review.json --html review.html --sarif review.sarif
```

## Investigate the failure boundary

Try a string literal containing eval(. Decide whether to add lexical-state parsing or leave it as a documented candidate requiring review.




## References

[Git diff format](https://git-scm.com/docs/diff-format)
[Python subprocess and JSON](https://docs.python.org/3/library/json.html)
