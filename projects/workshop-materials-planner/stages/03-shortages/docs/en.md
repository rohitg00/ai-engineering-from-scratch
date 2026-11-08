# Compute shortages and review uncertain conversions

Stage 3 of 4. Reconcile inventory without guessing unknown conversions.

## Build the mechanism

Twelve participants need 24 sheets; 20 on hand leaves 4 missing. For glue, 0.1 liter becomes 100 milliliters through an explicit factor of 1000.

```figure
pj-workshop-materials-planner-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement shortages(model,participants=None). An unconvertible inventory entry leaves available and shortage null.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py workshop-materials-planner --stage 3 --path learning-artifacts/workshop-materials-planner --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A bottle is not a standard unit of volume. Add its declared size to conversions or leave the uncertain row for review.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
