# Aggregate independent support

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Group valid findings by file, line and rule. Count one vote per reviewer per group, reject duplicate reviewer identities, and retain every severity vote. A quorum produces consensus; a singleton remains visible as needs-review. A disagreement flag survives consensus so the user can inspect conflicting severity judgments.

The boundary for this stage is `aggregate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

One reviewer repeats a finding five times and a second reviewer reports it once. Support is two distinct reviewer ids, not six reports. Severities[3,2] produce consensus with disagreement=true.

```figure
pj-multi-agent-code-review-panel-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `aggregate` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Group by the stable tuple(file,line,rule). Keep severity votes and supporter ids in the output rather than collapsing the decision into one boolean.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py multi-agent-code-review-panel --init learning-artifacts/multi-agent-code-review-panel`. Then grade cumulatively:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --stage 2 --path learning-artifacts/multi-agent-code-review-panel --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/multi-agent-code-review-panel
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

## Investigate the failure boundary

Raise quorum from 2 to3 on the sample. Identify which true finding becomes needs-review and which false positive was already a singleton.




## References

[AbortController in Node](https://nodejs.org/api/globals.html#class-abortcontroller)
[Node test runner](https://nodejs.org/api/test.html)
