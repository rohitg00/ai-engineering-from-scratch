---
id: ai-tutor-learning-tools
title: AI Tutors and Learning Tools
code: AL
subtitle: Trace mastery, ground every card in a source, plan paths and materials, and suggest words from your own corpus.
hue: 280
sources: phases/19-capstone-projects/17-personal-ai-tutor, projects/source-grounded-study-coach, projects/community-learning-path-finder, projects/vocabulary-autocomplete-pad, projects/workshop-materials-planner
source_hash: a4fbfc69c50084ba
---

## What each project builds
type: comparison
span: 2
from: projects/source-grounded-study-coach/README.md, projects/community-learning-path-finder/README.md, projects/vocabulary-autocomplete-pad/README.md, projects/workshop-materials-planner/README.md, projects/vocabulary-autocomplete-pad/solution/cli.ts, projects/vocabulary-autocomplete-pad/solution/main.ts

| Factor | Study coach | Path finder | Autocomplete pad | Materials planner |
|---|---|---|---|---|
| Builds | Practice page with review dates | Feasible learning path | Local writing pad | Packing list and shortages |
| Runtime | Node.js 22.18 | Python 3.10+ | Node 22.18 | Python 3.10+ |
| Input | Deck JSON and attempt events | Resources, goals, budget | Corpus of id and text | Participants, materials, inventory |
| Output | index.html, progress.json | learning-map.html, path.json | report.html, vocabulary-model.json | packing-list.csv, shortages.json |
| Review loop | Download attempts JSON | `--decisions decisions.json` | Download vocabulary-model.json | `--decisions decisions.json` |
| Limit | Exact answer match only | Self-reported progress | One next token, two of context | One concurrent session |

## Run and grade
type: command-table
span: 2
from: projects/source-grounded-study-coach/README.md, projects/community-learning-path-finder/README.md, projects/vocabulary-autocomplete-pad/README.md, projects/workshop-materials-planner/README.md, phases/19-capstone-projects/17-personal-ai-tutor/code/main.py, phases/19-capstone-projects/17-personal-ai-tutor/code/ts/README.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init <workspace>` | Makes a workspace. The first stage fails |
| `python3 scripts/project_test.py <project> --stage 1 --path <workspace> --strict` | Grades one stage |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks the reference solution |
| `node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output` | Builds the practice page and schedule |
| `python3 cli.py samples/input.json --output demo-output` | Runs path finder or materials planner |
| `node cli.ts sample.json output` | Trains the pad and writes output/report.html |
| `python main.py` | Runs the simulated tutor efficacy study |
| `npm run serve` | Tutor web app on :8090 |

## One tutor turn
type: flow
from: phases/19-capstone-projects/17-personal-ai-tutor/code/main.py, phases/19-capstone-projects/17-personal-ai-tutor/docs/en.md

1. **next_concept**: walk the DAG. Pick the first concept below 0.85 whose prereqs are all mastered.
2. **Difficulty**: 0.3 plus 0.1 for each prerequisite.
3. **Last action**: a prereq scaffold subtracts 0.15. A hint subtracts 0.08.
4. **Learner answers**: correct with sigmoid of knowledge minus difficulty.
5. **socratic_policy**: correct and above 0.8 gives `celebrate_and_advance`.
6. **socratic_policy**: correct gives `reinforce_and_next_question`. Wrong above 0.5 gives `hint`.
7. **socratic_policy**: wrong at 0.5 or below gives `scaffold_from_prereq`.
8. **bkt_update**: update mastery, then add the learn step.

## BKT update
type: annotated-code
lang: python
from: phases/19-capstone-projects/17-personal-ai-tutor/code/main.py

```python
p = BKTParams()                          # p_init, p_learn, p_slip, p_guess
if correct:
    num = mastery * (1 - p.p_slip)
    denom = num + (1 - mastery) * p.p_guess
else:
    num = mastery * p.p_slip
    denom = num + (1 - mastery) * (1 - p.p_guess)
posterior = num / max(denom, 1e-6)
return posterior + (1 - posterior) * p.p_learn   # learn transition
```

## Study coach loop
type: architecture
from: projects/source-grounded-study-coach/solution/main.ts, projects/source-grounded-study-coach/README.md

```arch
node | deck | 1,1 | deck.json | sources and cards | store
node | att | 1,2 | attempts.json | dated answers | store
node | val | 2,1 | validateDeck | offsets hold the answer | process
node | prog | 2,2 | buildProgress | box and due per card | process
node | exp | 3,1 | exportPractice | writes the outputs | process
node | page | 4,1 | index.html | reveal and record | client
node | json | 3,2 | progress.json | due cards | store
edge | deck | val |
edge | val | exp |
edge | att | prog | replay
edge | prog | exp |
edge | exp | page |
edge | exp | json |
edge | page | att | download
```

## Project functions
type: task-table
from: projects/source-grounded-study-coach/solution/main.ts, projects/community-learning-path-finder/API.md, projects/vocabulary-autocomplete-pad/README.md, projects/workshop-materials-planner/API.md

| Task | Code |
|---|---|
| Grade one typed answer | `gradeAnswer(deck, cardId, response)` |
| List due cards | `dueCards(progress, date)` |
| Order prerequisites | `path_for(index, target, completed=None)` |
| Rank paths in a budget | `rank_paths(index, goals, budget, completed=None)` |
| Suggest a next word | `suggest(model: Model, prefix: string, history?: string[], limit?: number)` |
| Load a saved model | `importModel(value: unknown)` |
| Scale materials | `scale(model, participants=None)` |
| Find shortages | `shortages(model, participants=None)` |

## Rules in code
type: concepts
from: projects/source-grounded-study-coach/solution/main.ts, projects/community-learning-path-finder/API.md, projects/vocabulary-autocomplete-pad/solution/main.ts, projects/workshop-materials-planner/API.md

- **Answer match**: NFKC, lower case, trim, drop end punctuation. Then exact match.
- **Box**: correct adds 1 up to 5. Wrong resets to 0.
- **Interval**: `2 ** (state.box - 1)` days when correct. 1 day when wrong.
- **Path rank**: most goals covered, then fewest minutes, then IDs.
- **Suggestion score**: `order * 1000000 + count`. A longer history wins.
- **Consumables**: `quantity*participants`.
- **Shared equipment**: `quantity*ceil(participants/share)`.
- **Unknown stock**: unconvertible inventory leaves shortage unknown.

## Defaults and numbers
type: defaults
from: phases/19-capstone-projects/17-personal-ai-tutor/code/main.py, projects/community-learning-path-finder/API.md, projects/vocabulary-autocomplete-pad/solution/main.ts, projects/workshop-materials-planner/solution/cli.py

| Setting | Default | Note |
|---|---|---|
| `p_init` | 0.2 | Prior knowledge |
| `p_learn` | 0.12 | Learn rate per practice |
| `p_slip`, `p_guess` | 0.10 | Guess is 0.15 |
| `master_threshold` | 0.85 | Mastered concepts are skipped |
| Catalog size | 18 | Exact planner maximum |
| `suggest` limit | 5 | Allowed range 0..50 |
| Planner `compare` | [8, 12] | Participant counts to compare |
| Study `n_turns` | 60 | 10 learners in each arm |

## Errors and fixes
type: troubleshooting
from: projects/source-grounded-study-coach/solution/main.ts, projects/community-learning-path-finder/solution/main.py, projects/vocabulary-autocomplete-pad/solution/main.ts, projects/workshop-materials-planner/solution/main.py

| Symptom | Cause | Fix |
|---|---|---|
| "Canonical answer must occur in the evidence quote" | Offsets miss the answer | Fix `start` and `end` in UTF-16 units |
| "Conflicting duplicate attempt ID" | Same id, other content | Give each attempt a new id |
| "Proposal lacks verbatim answer evidence" | Model quote is not in the source | Reject it. Keep the deck unchanged |
| "prerequisite cycle" | Resources need each other | Remove one prerequisite edge |
| "stale progress" | Input changed after export | Rerun, then edit the new decisions |
| "complete prerequisites first" | Progress skips a step | Mark the prerequisites done first |
| "inconsistent conversion cycle" | Two unit paths disagree | Fix the conversion factors |
| "Unsupported model schema" | `schemaVersion` is not 1 | Load a model with schema version 1 |

## Abbreviations
type: glossary
from: phases/19-capstone-projects/17-personal-ai-tutor/docs/en.md, phases/19-capstone-projects/17-personal-ai-tutor/code/ts/README.md

- **BKT**: Bayesian knowledge tracing. Mastery probability per concept.
- **FSRS**: Free Spaced Repetition Scheduler. Better than SM-2.
- **DAG**: concept graph with prerequisite edges.
- **COPPA**: US law that restricts data from children under 13.
- **OER**: open content attached to each curriculum node.

## Questions
type: qa
from: phases/19-capstone-projects/17-personal-ai-tutor/docs/en.md, projects/source-grounded-study-coach/README.md, projects/workshop-materials-planner/API.md

- **What does the tutor do when asked for the answer?** It asks a leading question.
- **What proves the tutor works?** A pre/post test delta with 10 learners over two weeks.
- **Does the study coach judge essays?** No. It uses authored questions and exact matches.
- **Does a model card go into the deck?** No. It goes to card-proposal.json for review.
- **Does the planner guess glue volume?** No. It never infers density or package size.

## Tips
type: tips
from: phases/19-capstone-projects/17-personal-ai-tutor/docs/en.md, projects/source-grounded-study-coach/README.md, projects/community-learning-path-finder/README.md

- Build a curriculum graph of 50-150 concept nodes.
- Compare with a non-adaptive baseline on the same content.
- Auto-delete memory after 1 year. Scope it by learner ID.
- Pass the review date from the page to `--date`.
- Keep a second set of examples for evaluation.
- Reloading the practice page before download discards new attempts.
