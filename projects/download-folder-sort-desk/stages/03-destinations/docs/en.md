# Plan destinations and surface naming conflicts

Stage 3 of 4. Reserve each destination before planning the next file.

## Build the mechanism

Two note.txt files become documents/note.txt and documents/note-2.txt. Existing occupied paths participate in the same collision set.

```figure
pj-download-folder-sort-desk-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement plan_moves(records, occupied=None); groups contain every source sharing a content digest.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py download-folder-sort-desk --stage 3 --path learning-artifacts/download-folder-sort-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Case-fold destinations to avoid common case-insensitive filesystem collisions. Duplicate bytes are reported, never deleted.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
