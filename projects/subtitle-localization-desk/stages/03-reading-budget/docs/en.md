# Review cue length, terminology and meaning

Stage 3 of 4. Calculate reading pressure without shifting timestamps.

## Build the mechanism

A 3-second cue at 12 characters per second has a 36-character non-whitespace budget. A longer caption is flagged for revision.

```figure
pj-subtitle-localization-desk-3
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement inspect(proposals,cps=17), stripping cue tags before counting visible non-whitespace code points.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py subtitle-localization-desk --stage 3 --path learning-artifacts/subtitle-localization-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Code-point count is a transparent approximation, not language-specific reading speed. Glossary checks do not certify meaning.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
