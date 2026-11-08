# Generate candidate pairs and explain similarity

Stage 2 of 4. Rank explainable pairs with weighted token overlap.

## Build the mechanism

"River Atlas" versus "Atlas" has title overlap 1/2. Matching creator Ada yields 0.8×0.5+0.2×1=0.6.

```figure
pj-catalog-record-linker-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement candidates(left,right,threshold=0.25), reporting both component scores.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py catalog-record-linker --stage 2 --path learning-artifacts/catalog-record-linker --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Matching words are only candidates. "River Atlas" and "River Atlas Junior" may be different editions.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
