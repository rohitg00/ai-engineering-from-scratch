# Measure panel precision and recall

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Evaluate unique finding ids against an expected set. Precision measures how many predicted findings are expected; recall measures how much of the expected set was found. Deduplicate both sets so repeated reviewers cannot inflate the metric. Zero predictions produce precision zero rather than a misleading perfect score. Try held-out inputs before adjusting quorum.

The boundary for this stage is `evaluate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The broad local reviewer predicts three findings with two true positives, so precision=2/3. Quorum retains the two expected findings: precision=1 and recall=1 on this sample. A budget of1 leaves no consensus and recall 0.

```figure
pj-multi-agent-code-review-panel-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `evaluate` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Compare individual and combined predictions against the same expected set. Deduplicate both sets and retain the source fingerprint; metrics from a different snapshot are not comparable evidence.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py multi-agent-code-review-panel --init learning-artifacts/multi-agent-code-review-panel`. Then grade cumulatively:

```bash
python3 scripts/project_test.py multi-agent-code-review-panel --stage 4 --path learning-artifacts/multi-agent-code-review-panel --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/multi-agent-code-review-panel
node cli.ts --input samples/review.json --output panel.json --html panel.html
```

## Investigate the failure boundary

Hold out a case found by only one reviewer. Measure whether quorum loses that true positive before presenting agreement as an improvement.

Local reviewers are distinct static heuristics, not independent LLMs. Consensus measures support, not truth. External callbacks must honor AbortSignal; timeout cannot undo a remote side effect.


## References

[AbortController in Node](https://nodejs.org/api/globals.html#class-abortcontroller)
[Node test runner](https://nodejs.org/api/test.html)
