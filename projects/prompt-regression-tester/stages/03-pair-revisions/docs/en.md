# Compare the same cases across revisions

**Stage 3 of 4.** Python. Plan about 2 hours.

An average can hide a serious regression. Pair revisions by case id and label each as improved, regressed, stable pass, or stable fail. A new success must not cancel a lost required behavior.

Use the same case list for both revisions. Extra cassette keys are ignored and missing keys fail. This lets you compare revisions even when one recording job was incomplete without fabricating a result.

```figure
pj-prompt-regression-tester-3
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/difflib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Structured outputs](../../../../../phases/11-llm-engineering/03-structured-outputs/docs/en.md). Complete [stage 2](../../02-score-recordings/docs/en.md) first.

The candidate fixes source attribution but replaces machine-readable JSON with friendly prose. Pair case ids before calculating the average: one improvement does not repair another broken interface.

```text
format-json: pass -> fail = regressed
source-link: fail -> pass = improved
aggregate pass rate: unchanged
```

## Build and inspect

Keep model, settings and case hash alongside the responses. The CLI rejects changed model/settings unless you explicitly allow that experiment.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py prompt-regression-tester --stage 3 --path learning-artifacts/prompt-regression-tester
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How would you explain a flat pass rate to the owner of the JSON consumer?
