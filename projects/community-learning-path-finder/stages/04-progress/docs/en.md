# Export an editable learning map and integration contract

Stage 4 of 4. Export the learning map and validate completion receipts.

## Build the mechanism

Marking basics complete reduces remaining minutes while preserving the original plan. Marking publishing complete without collection is rejected.

```figure
pj-community-learning-path-finder-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains resources, goals, budget and optional completed IDs. Outputs learning-map.html, path.json, unmet-prerequisites.json. Edit the HTML progress JSON and download decisions.json, then rerun with --decisions decisions.json. A course platform imports path.json path entries in array order, retaining id, prerequisites, minutes and completed fields.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py community-learning-path-finder --stage 4 --path learning-artifacts/community-learning-path-finder --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

HTML edits represent self-reported progress. The importer validates dependency consistency and fingerprints, not learner identity or assessment success.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
