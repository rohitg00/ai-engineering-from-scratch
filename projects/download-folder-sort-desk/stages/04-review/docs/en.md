# Export a reviewed filing plan for a file manager

Stage 4 of 4. Check source identities before consuming selected moves.

## Build the mechanism

Selecting handout.txt produces approved=true for that file. If its content changes after inventory, validation refuses the plan.

```figure
pj-download-folder-sort-desk-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains folder relative to the JSON file and optional occupied destination strings. Outputs: moves.json, duplicates.json, review.html. Download and edit decisions.json with the retained fingerprint and an approved array of source paths, then rerun with --decisions decisions.json. A file manager imports review_plan(folder, json.load(open("moves.json")), decisions) and executes only its approved moves after checking destination availability.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py download-folder-sort-desk --stage 4 --path learning-artifacts/download-folder-sort-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

No files move in this project. File managers must reserve destinations and recheck identity immediately before a move; this planning gate is not a transaction or OS sandbox.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
