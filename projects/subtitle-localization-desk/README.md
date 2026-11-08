# Subtitle Localization Desk

Help a course creator localize supplied WebVTT captions through a glossary, an optional real translation provider and an explicit review step. Preserve cue identities and timestamps, flag text that exceeds the chosen reading budget, and export reviewed captions with a side-by-side HTML desk.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py subtitle-localization-desk --init learning-artifacts/subtitle-localization-desk
python3 scripts/project_test.py subtitle-localization-desk --stage 1 --path learning-artifacts/subtitle-localization-desk --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py subtitle-localization-desk --all --path learning-artifacts/subtitle-localization-desk --strict
cd learning-artifacts/subtitle-localization-desk
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py subtitle-localization-desk --all --solution --strict
cd projects/subtitle-localization-desk/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input JSON contains vtt, translations, glossary and optional cps. Outputs review.html and translation-decisions.json. Download decisions.json, edit cue text and approved flags, then rerun with --decisions decisions.json. reviewed.vtt is created only when all cues are approved; an over-budget cue additionally needs override_budget=true. Consume reviewed.vtt with parse_vtt or a video player WebVTT track.

## Worked example and limits

Cue map opens at 00:00.000 and closes at 00:03.000. Its three-second window is preserved through every translation.

The offline core uses supplied translations and does not call a translation provider. An optional provider adapter can populate the same translations map; every result still requires review. Semantic quality depends on a bilingual reviewer.

## Stages

1. [Parse subtitle cues and preserve their timing](stages/01-cues/docs/en.md)
2. [Apply a glossary to translation proposals](stages/02-glossary/docs/en.md)
3. [Review cue length, terminology and meaning](stages/03-reading-budget/docs/en.md)
4. [Export localized captions and their review decisions](stages/04-review-export/docs/en.md)

## Primary references

- [Technical reference](https://www.w3.org/TR/webvtt1/)
