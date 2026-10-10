# Inventory files and compute content identities

Stage 1 of 4. Hash bytes and retain root-relative file identities.

## Build the mechanism

handout.txt and duplicate.txt contain the same bytes. Their filenames differ while their SHA-256 values agree.

```figure
pj-download-folder-sort-desk-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement inventory(folder), streaming regular files and rejecting symlinks.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py download-folder-sort-desk --stage 1 --path learning-artifacts/download-folder-sort-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

A symlink may escape the selected root. The inventory refuses it; file contents are never executed.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
