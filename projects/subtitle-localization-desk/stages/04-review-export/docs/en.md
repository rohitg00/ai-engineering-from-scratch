# Export localized captions and their review decisions

Stage 4 of 4. Require explicit review before emitting localized WebVTT.

## Build the mechanism

The reviewer shortens one long Spanish cue, approves each cue and downloads decisions. Exported timestamps and cue identities match the original.

```figure
pj-subtitle-localization-desk-4
```

Change the controls, predict the intermediate result, and compare it with the computed evidence. The visual explains this stage; grading executes your Python functions.

## Exact contract

Input JSON contains vtt, translations, glossary and optional cps. Outputs review.html and translation-decisions.json. Download decisions.json, edit cue text and approved flags, then rerun with --decisions decisions.json. reviewed.vtt is created only when all cues are approved; an over-budget cue additionally needs override_budget=true. Consume reviewed.vtt with parse_vtt or a video player WebVTT track.

Read [API.md](../../../API.md), including return fields and failure behavior. The first starter supplies file I/O and HTML presentation; implement the domain functions in `main.py`. Keep earlier functions passing because later stages compose them.

## Verify it

```bash
python3 scripts/project_test.py subtitle-localization-desk --stage 4 --path learning-artifacts/subtitle-localization-desk --strict
```

The stage tests include held-out inputs independent of the demo, boundaries, malformed data and an adversarial case. Inspect the failing assertion before changing a rule.

## Failure boundary and extension

The offline core uses supplied translations and does not call a translation provider. An optional provider adapter can populate the same translations map; every result still requires review. Semantic quality depends on a bilingual reviewer.

After all four stages, run `python3 cli.py samples/input.json --output my-output` inside your learner workspace. Replace the sample path with your own JSON document, inspect the files and feed the exported artifact to the consumer described in the project README.
