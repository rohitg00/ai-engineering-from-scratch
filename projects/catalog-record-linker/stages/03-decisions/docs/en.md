# Review matches and resolve conflicting fields

Stage 3 of 4. Require explicit one-to-one links and field resolutions.

## Build the mechanism

A reviewer links two atlas records and selects the correct publication year. An unresolved year is retained as a conflict beside the chosen left value.

```figure
pj-catalog-record-linker-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement reconcile(left,right,decisions), preserving sources and unmatched records.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py catalog-record-linker --stage 3 --path learning-artifacts/catalog-record-linker --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Reject two accepted matches sharing the same record. Many-to-one identity resolution needs a separate policy.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
