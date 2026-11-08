# Evidence: cheatsheets/localization-workbenches.md

Abbreviations. L = phases/05-nlp-foundations-to-advanced/18-multilingual-nlp. SD = projects/subtitle-localization-desk. UI = projects/ui-string-localization-workbench. GH = projects/glossary-hovercard-publisher.

## Front matter
- id, title, sources: cheatsheets/topics.yaml:1549-1556

## Three projects side by side (comparison)
- Builds: SD/project.json:23, UI/README.md:5, GH/README.md:5
- Language: SD/README.md:5, UI/README.md:9, GH/README.md:9
- Input keys: SD/README.md:31, SD/solution/cli.py:13,18. UI/solution/cli.ts:25-26,33. GH/solution/cli.ts:20-21
- Outputs: SD/solution/cli.py:22,26,53. UI/solution/cli.ts:28-32. GH/solution/cli.ts:22-24
- Review file: SD/README.md:31. UI/solution/cli.ts:10,16-18,30. GH/solution/cli.ts:20-21 (review is read at 11-13 but not passed on)
- Hard gate: SD/README.md:31. UI/solution/main.ts:126-134. GH/README.md:48

## Run the reference (command-table)
- python3 cli.py samples/input.json --output demo-output: SD/README.md:27
- your input: SD/README.md:28
- node cli.ts sample.json output: UI/README.md:13, GH/README.md:13
- review as third argument: UI/solution/cli.ts:10,12
- --help: UI/README.md:16, UI/solution/cli.ts:11-12

## Build and grade your version (task-table)
- --init: SD/README.md:10, UI/README.md:21, GH/README.md:21
- --stage 1 --path --strict: SD/README.md:11, UI/README.md:22
- --all --path --strict: SD/README.md:17, UI/README.md:23
- --report completion.json: UI/README.md:23, GH/README.md:23
- --all --solution --strict: SD/README.md:25, UI/README.md:45, GH/README.md:45

## Subtitle desk pipeline (flow)
- parse_vtt, cue-N, timestamps preserved: SD/API.md:11, SD/solution/main.py:27-28
- propose, longest first: SD/API.md:19, SD/solution/main.py:86-91
- inspect, budget=floor(duration*cps): SD/API.md:27, SD/solution/main.py:111-113
- fingerprint SHA-256 of proposals and cps: SD/solution/main.py:137-139, SD/API.md:35
- edit decisions.json, rerun with --decisions: SD/README.md:31
- reviewed.vtt only when all approved: SD/solution/cli.py:25-28, SD/README.md:31

## Subtitle input (annotated-code)
- vtt with map cue 00:00.000 --> 00:03.000: SD/solution/samples/input.json:2
- "map": "Abre el map.": SD/solution/samples/input.json:4. Glossary replace: SD/solution/main.py:86-91
- label cue 00:12.000 --> 00:14.000 (2 s), cps 12, floor(2*12)=24: SD/solution/samples/input.json:2,8,15, SD/solution/main.py:113
- glossary map/marker: SD/solution/samples/input.json:11-14
- cps optional, default 17: SD/README.md:31, SD/API.md:24

## UI string workbench flow (architecture)
- sample.json messages, proposals: UI/solution/sample.json:3,22
- readCatalog keys, placeholders: UI/solution/main.ts:21-43
- proposeTranslations issues, needsContext: UI/solution/main.ts:45-78
- reviewTranslations approve, reject, pending: UI/solution/main.ts:89-146
- locale.json catalog: UI/solution/cli.ts:28
- unresolved-strings.json: UI/solution/cli.ts:29

## Glossary publisher rules (concepts)
- Term id pattern and unique: GH/solution/main.ts:23-24
- repeated phrase, lower case key: GH/solution/main.ts:30-33
- longest first, word boundary: GH/solution/main.ts:43-57
- pre, code, a skipped: GH/solution/main.ts:143-146
- allowed attributes, href only on a: GH/solution/main.ts:128-132
- href rule: GH/solution/main.ts:133-134
- button with aria-expanded, role="note": GH/solution/main.ts:157

## Error messages and fixes (troubleshooting)
- stale review: SD/solution/main.py:141-142. decisions from review.html: SD/solution/cli.py:53-59
- resolve glossary or acknowledge...: SD/solution/main.py:169-173
- STYLE and REGION...: SD/solution/main.py:25-26. NOTE ignored: SD/solution/main.py:23-24
- Placeholder multiset changed: UI/solution/main.ts:72-73
- Stale or invalid translation decision: UI/solution/main.ts:119-124
- Resolve translation issues or context before approving: UI/solution/main.ts:127-134
- Ambiguous repeated phrase: GH/solution/main.ts:32
- Unsupported HTML element: GH/solution/main.ts:107

## Defaults and limits (defaults)
- cps 17, positive and finite: SD/solution/main.py:103,107-108, SD/solution/cli.py:18
- schema_version 1: SD/solution/main.py:202
- approved False: SD/solution/main.py:149, SD/solution/cli.py:57
- override_budget False: SD/solution/main.py:178
- Proposal 2000 characters: UI/solution/main.ts:68-69
- schemaVersion 1: UI/solution/main.ts:101
- Output folder output: UI/solution/cli.ts:10
- Exit code 2: UI/solution/cli.ts:53-55

## Pick a multilingual model (task-table)
- XLM-R-base: L/docs/en.md:154
- joeddav/xlm-roberta-large-xnli: L/docs/en.md:155
- facebook/nllb-200-distilled-600M: L/docs/en.md:157
- XLM-V or related-language fine-tune: L/docs/en.md:159
- num_train_epochs=5: L/docs/en.md:130,139
- learning_rate=2e-5: L/docs/en.md:131,139
- byte_fallback=True: L/docs/en.md:173

## Source language choice (qa)
- similarity beats corpus size: L/docs/en.md:48
- Marathi, Hindi above English: L/code/main.py:23-26,50
- 100 to 500, 95 to 98 percent: L/docs/en.md:28
- alignment collapse: L/docs/en.md:139
- fertility 3 to 5 times: L/docs/en.md:167

## Tips (tips)
- per-language accuracy: L/docs/en.md:143
- verify fertility: L/docs/en.md:173
- review needed: SD/README.md:37, UI/README.md:48
- simple placeholders, not ICU: UI/README.md:48
- phrases never cross elements or entities: GH/README.md:48
- local HTML, no third-party service: UI/README.md:40, GH/README.md:40
