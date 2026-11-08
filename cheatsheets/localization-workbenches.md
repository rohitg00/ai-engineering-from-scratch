---
id: localization-workbenches
title: Localization and Glossary Tools
code: LG
subtitle: Run, feed and check three review-first localization projects. Pick a multilingual model and a source language.
hue: 28
sources: phases/05-nlp-foundations-to-advanced/18-multilingual-nlp, projects/subtitle-localization-desk, projects/ui-string-localization-workbench, projects/glossary-hovercard-publisher
source_hash: 8406a26bb6811eb3
---

## Three projects side by side
type: comparison
span: 2
from: projects/subtitle-localization-desk/README.md, projects/subtitle-localization-desk/project.json, projects/subtitle-localization-desk/solution/cli.py, projects/ui-string-localization-workbench/README.md, projects/ui-string-localization-workbench/solution/cli.ts, projects/glossary-hovercard-publisher/README.md, projects/glossary-hovercard-publisher/solution/cli.ts

| Factor | Subtitle Localization Desk | UI String Localization Workbench | Glossary Hovercard Publisher |
|---|---|---|---|
| Builds | Reviewed WebVTT and an HTML desk | Reviewed locale JSON and a preview | Annotated HTML lesson |
| Language | Python 3.10+ | Node 22.18 or newer | Node 22.18 or newer |
| Input keys | `vtt`, `translations`, `glossary`, `cps` | `locale`, `messages`, `proposals`, `values` | `glossary`, `lesson` |
| Outputs | `review.html`, `translation-decisions.json`, `reviewed.vtt` | `locale.json`, `unresolved-strings.json`, `report.html` | `report.html`, `glossary.json`, `coverage.json` |
| Review file | `--decisions decisions.json` | third argument `locale-review.json` | none |
| Hard gate | `reviewed.vtt` only when all cues approved | approve only with no issues | balanced HTML subset |

## Run the reference
type: command-table
from: projects/subtitle-localization-desk/README.md, projects/ui-string-localization-workbench/README.md, projects/ui-string-localization-workbench/solution/cli.ts, projects/glossary-hovercard-publisher/README.md

| Command | What it does |
|---|---|
| `python3 cli.py samples/input.json --output demo-output` | Subtitle desk on the sample |
| `python3 cli.py <input.json> --output <dir>` | Subtitle desk on your input |
| `node cli.ts sample.json output` | UI workbench or glossary publisher |
| `node cli.ts <input.json> <dir> <review.json>` | UI workbench with your review |
| `node cli.ts --help` | Prints the argument line |

## Build and grade your version
type: task-table
span: 2
from: projects/subtitle-localization-desk/README.md, projects/ui-string-localization-workbench/README.md, projects/glossary-hovercard-publisher/README.md

| Task | Code |
|---|---|
| Make a starter | `python3 scripts/project_test.py <project> --init <dir>` |
| Grade one stage | `python3 scripts/project_test.py <project> --stage 1 --path <dir> --strict` |
| Grade all stages | `python3 scripts/project_test.py <project> --all --path <dir> --strict` |
| Save a completion report | `--report completion.json` |
| Grade the reference | `python3 scripts/project_test.py <project> --all --solution --strict` |

## Subtitle desk pipeline
type: flow
from: projects/subtitle-localization-desk/API.md, projects/subtitle-localization-desk/solution/main.py, projects/subtitle-localization-desk/solution/cli.py

1. **parse_vtt**: reads WebVTT into cues. It keeps timestamp strings and gives `cue-N` to cues with no id.
2. **propose**: takes supplied translations. It replaces source glossary terms longest first.
3. **inspect**: counts visible characters and sets `budget=floor(duration*cps)`.
4. **export_localized**: binds the review to a SHA-256 `fingerprint` of proposals and cps.
5. **You**: edit `decisions.json`, set `approved` per cue, then run again with `--decisions`.
6. **CLI**: writes `reviewed.vtt` only when every cue is approved.

## Subtitle input (samples/input.json)
type: annotated-code
lang: text
from: projects/subtitle-localization-desk/solution/samples/input.json, projects/subtitle-localization-desk/API.md

```text
{
  "vtt": "WEBVTT\n\nmap\n00:00.000 --> 00:03.000\nOpen the map.\n...",
  "translations": {
    "map": "Abre el map.",  # glossary turns it into "Abre el mapa."
    "label": "Escribe un nombre descriptivo ..."  # 2 s at cps 12, budget 24
  },
  "glossary": {"map": "mapa", "marker": "marcador"},  # source to target
  "cps": 12  # optional, the default is 17
}
```

## UI string workbench flow
type: architecture
from: projects/ui-string-localization-workbench/solution/main.ts, projects/ui-string-localization-workbench/solution/cli.ts, projects/ui-string-localization-workbench/README.md

```arch
node | in | 1,1 | sample.json | messages, proposals | client
node | read | 2,1 | readCatalog() | keys, placeholders | process
node | prop | 3,1 | proposeTranslations() | issues, needsContext | process
node | rev | 3,2 | reviewTranslations() | approve, reject, pending | process
node | loc | 1,2 | locale.json | approved strings | store
node | unr | 2,2 | unresolved-strings.json | keys with reasons | store
edge | in | read | messages
edge | read | prop | Message[]
edge | prop | rev | Proposal[]
edge | rev | loc | catalog
edge | rev | unr | unresolved
```

## Glossary publisher rules
type: concepts
from: projects/glossary-hovercard-publisher/solution/main.ts, projects/glossary-hovercard-publisher/README.md

- **Term id**: lower case, matches `^[a-z][a-z0-9-]*$`, and is unique.
- **Phrases**: a term or alias must not repeat across the glossary, in any case.
- **Matching**: `matchTerms()` tries the longest phrase first and needs word boundaries.
- **Skipped text**: text inside `pre`, `code` and `a` stays untouched.
- **Attributes**: only `class`, `id`, `title`, `lang` and `href` on `a`.
- **Links**: `href` must start with `https://`, `http://` or `#`.
- **Definition**: a native button with `aria-expanded` shows a `role="note"` span.

## Error messages and fixes
type: troubleshooting
from: projects/subtitle-localization-desk/solution/main.py, projects/subtitle-localization-desk/solution/cli.py, projects/ui-string-localization-workbench/solution/main.ts, projects/glossary-hovercard-publisher/solution/main.ts

| Symptom | Cause | Fix |
|---|---|---|
| `stale review` | Proposals or cps changed after review | Use the new `decisions.json` from `review.html` |
| `resolve glossary or acknowledge reading-budget overflow` | Approved cue misses a term or the budget | Add the term or set `override_budget` to true |
| `STYLE and REGION are outside the supported subset` | VTT has STYLE or REGION blocks | Remove them. NOTE blocks are ignored |
| `Placeholder multiset changed` | Translation drops or adds a `{name}` | Keep every placeholder of the source |
| `Stale or invalid translation decision` | Review translation differs from the proposal | Download a new `locale-review.json` |
| `Resolve translation issues or context before approving` | Ambiguous key not acknowledged | Set `acknowledgeContext` to true |
| `Ambiguous repeated phrase` | Same phrase in two terms | Give each phrase one term |
| `Unsupported HTML element` | Tag outside the allowed subset | Use the listed tags only |

## Defaults and limits
type: defaults
from: projects/subtitle-localization-desk/solution/main.py, projects/subtitle-localization-desk/solution/cli.py, projects/ui-string-localization-workbench/solution/main.ts, projects/ui-string-localization-workbench/solution/cli.ts

| Setting | Default | Note |
|---|---|---|
| `cps` | 17 | Must be positive and finite |
| `schema_version` | 1 | In `translation-decisions.json` |
| `approved` | `False` | Every cue starts unapproved |
| `override_budget` | `False` | Needed for an over-budget approval |
| Proposal length | 2000 | Characters at most per proposal |
| `schemaVersion` | 1 | Required in `locale-review.json` |
| Output folder | `output` | Second argument of the Node CLIs |
| Exit code on error | 2 | The Node CLIs print the message |

## Pick a multilingual model
type: task-table
from: phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md

| Task | Code |
|---|---|
| Classification, 100 languages | `XLM-R-base` fine-tuned |
| Zero-shot classification | `joeddav/xlm-roberta-large-xnli` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` |
| Low-resource language | `XLM-V` or a related-language fine-tune |
| Few-shot epochs | `num_train_epochs=5` |
| Few-shot learning rate | `learning_rate=2e-5` |
| Long-tail scripts | `byte_fallback=True` |

## Source language choice
type: qa
from: phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/code/main.py

- **Is English always the best source?** No. Language similarity predicts transfer better than corpus size.
- **Marathi target?** `rank_source_languages()` puts Hindi above English.
- **How many target labels?** 100 to 500 examples give 95 to 98 percent of the English baseline.
- **Why not a higher learning rate?** The multilingual alignment collapses to an English-only model.
- **What is the fertility tax?** Hindi can need 3 to 5 times the tokens of English.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, projects/subtitle-localization-desk/README.md, projects/ui-string-localization-workbench/README.md, projects/glossary-hovercard-publisher/README.md

- Report accuracy per language. An aggregate hides the long tail.
- Check tokenization fertility on target text before you train.
- Every translation needs a human review. The tools only flag problems.
- The UI workbench supports simple named placeholders, not ICU messages.
- Glossary phrases never cross elements or entity boundaries.
- The HTML runs locally and sends no data to a third-party service.
