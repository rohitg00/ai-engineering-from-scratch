# Score categories from visible file features

Stage 2 of 4. Explain categories from extension and filename evidence.

## Build the mechanism

workshop-handout.csv earns tables=3 and documents=2, so tables wins with both scores visible.

```figure
pj-download-folder-sort-desk-2
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement categorize(record). The filename is weak evidence; recognized extensions receive three points.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py download-folder-sort-desk --stage 2 --path learning-artifacts/download-folder-sort-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

This is a transparent filing heuristic, not MIME verification or malware analysis. Add a format probe separately.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
