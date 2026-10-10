# Parse subtitle cues and preserve their timing

Stage 1 of 4. Parse cue identities and preserve exact timing strings.

## Build the mechanism

Cue map opens at 00:00.000 and closes at 00:03.000. Its three-second window is preserved through every translation.

```figure
pj-subtitle-localization-desk-1
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Implement parse_vtt(text). The supported subset keeps cue IDs, settings and multiline text; it skips NOTE blocks and rejects STYLE/REGION.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py subtitle-localization-desk --stage 1 --path learning-artifacts/subtitle-localization-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

Overlapping cues are legal; decreasing start times and zero-length intervals are not accepted.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
