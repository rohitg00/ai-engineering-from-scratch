# Import two catalogs with stable source identifiers

Stage 1 of 4. Retain stable IDs and original catalog fields.

## Build the mechanism

left:map-1 and right:r-7 may describe the same atlas, but neither source record is discarded.

```figure
pj-catalog-record-linker-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement import_catalog(text, source); require id,title columns and reserve source/source_id.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py catalog-record-linker --stage 1 --path learning-artifacts/catalog-record-linker --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Duplicate IDs make decisions ambiguous. Reject them before candidate generation.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
