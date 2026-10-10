# Export packing lists and participant-count scenarios

Stage 4 of 4. Compare participant counts and export a packing receipt.

## Build the mechanism

Move the HTML participant slider from 8 to 12. Requirements and shortages are computed from the same materials model for each count.

```figure
pj-workshop-materials-planner-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains participants, materials, inventory, conversions and optional compare counts. Outputs packing-list.csv, shortages.json, planner.html. The slider supports 0 through 100 participants; the CLI supports arbitrary nonnegative integers. Download decisions.json to save the chosen count, rerun with --decisions decisions.json, then import packing-list.csv into a spreadsheet with csv.DictReader.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py workshop-materials-planner --stage 4 --path learning-artifacts/workshop-materials-planner --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Sharing assumes one concurrent session and unlimited reuse within each group. It does not schedule sequential workshops, procurement lead times or material substitutions.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
