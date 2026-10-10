# Export the crosswalk and merged catalog

Stage 4 of 4. Export a source-preserving crosswalk and reviewed entities.

## Build the mechanism

Read crosswalk.csv with csv.DictReader, join its source_id to the original catalog and locate the resulting entity in merged-catalog.json.

```figure
pj-catalog-record-linker-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input has left_csv, right_csv and optional threshold. Outputs are crosswalk.csv, merged-catalog.json, review.html. Download decisions.json, add {left,right,match,values} entries in pairs, then pass --decisions decisions.json. A fingerprint rejects reviews for different source inputs.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py catalog-record-linker --stage 4 --path learning-artifacts/catalog-record-linker --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

No similarity automatically merges records. ready reports resolved accepted merges; it does not claim every candidate was inspected.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
