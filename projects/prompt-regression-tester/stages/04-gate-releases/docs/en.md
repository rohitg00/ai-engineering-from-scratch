# Gate releases on explicit tolerances

**Stage 4 of 4.** Python. Plan about 2 hours.

A release rule converts measurements into a decision. Require a minimum pass fraction and a maximum number of regressions. Check the threshold domain first: NaN and out-of-range values must not disable the gate.

An empty suite fails closed. A release decision with zero evidence is not the same as a release with zero failures. The output keeps its measurements next to the decision for review.

```figure
pj-prompt-regression-tester-4
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/difflib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Structured outputs](../../../../../phases/11-llm-engineering/03-structured-outputs/docs/en.md). Complete [stage 3](../../03-pair-revisions/docs/en.md) first.

Your release gate is an executable policy. With three cases and one regression, a candidate is blocked even if its other responses improve. Save the JSON and Markdown diff as CI artifacts.

```text
cases=3; candidate passes=2; regressions=1
minimum pass fraction=1; regression budget=0
decision=block; CLI exit=1
```

## Build and inspect

Check that thresholds are finite and the suite is nonempty before comparing numbers. Exit status must agree with the reported decision.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py prompt-regression-tester --stage 4 --path learning-artifacts/prompt-regression-tester
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/prompt-regression-tester/cli.py projects/prompt-regression-tester/examples/cases.json projects/prompt-regression-tester/examples/baseline.json projects/prompt-regression-tester/examples/candidate.json --out prompt-diff.json --markdown prompt-diff.md
```

The supplied recordings are authored fixtures. The tool compares recorded responses; it does not call a model or establish semantic correctness. JSON case and response files are the public interface. A blocked gate exits 1.

## Investigate next

Which assertion would you add after a real support incident, and how would you keep its recording provenance?
