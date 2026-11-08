---
id: decision-briefing-tools
title: Decision, Change and Tutorial Tools
code: DT
subtitle: Four evidence tools. Score options, brief page changes, check API tutorials and compare local model runs.
hue: 205
sources: projects/decision-tradeoff-explorer, projects/web-change-brief, projects/api-tutorial-runner, projects/local-model-eval-harness
source_hash: 966cc7216fdac29d
---

## Four projects side by side
type: comparison
span: 3
from: projects/decision-tradeoff-explorer/README.md, projects/decision-tradeoff-explorer/solution/cli.ts, projects/web-change-brief/README.md, projects/web-change-brief/solution/main.go, projects/api-tutorial-runner/README.md, projects/api-tutorial-runner/solution/cli.ts, projects/local-model-eval-harness/README.md, projects/local-model-eval-harness/solution/cli.py

| Factor | Decision Tradeoff Explorer | Web Change Brief | API Tutorial Runner | Local Model Eval Harness |
|---|---|---|---|---|
| Language | Node 22.18+ | Go 1.22 or newer | Node 22.18 or newer | Python 3.10+ |
| Input | `criteria`, `options` | two HTML snapshots, or baseline and URL | `tutorial`, `fixture` or `endpoint` | `manifest`, `source`, `labels`, `records` |
| Outputs | `criteria.csv`, `decision-record.json`, `index.html` | `index.html`, `changes.json`, `baseline.json` | `requests.json`, `results.json`, `junit.xml`, `report.html` | `scorecard.json`, `reliability.html` |
| Gate | Chosen option must be eligible | `--accept` replaces the baseline | `--allow-network` for real endpoints | `--min-accuracy` exits 2 |
| Never does | Decide for the user | Run JavaScript or fetch linked resources | Load testing | Download or start a model |

## Run the reference
type: command-table
span: 2
from: projects/decision-tradeoff-explorer/README.md, projects/web-change-brief/README.md, projects/api-tutorial-runner/README.md, projects/local-model-eval-harness/README.md

| Command | What it does |
|---|---|
| `node --experimental-strip-types cli.ts fixtures/exhibition.json /tmp/decision-board` | Writes the decision board |
| `python3 -m http.server 8123 --directory /tmp/decision-board` | Serves it on localhost:8123. Stop it after use |
| `go run . --before fixtures/before.html --after fixtures/after.html --url <url> --out ./web-change-output` | Compares two saved snapshots |
| `go run . --fetch <url> --baseline ./web-change-output/baseline.json --out ./next-report` | Fetches one live page against the baseline |
| `node cli.ts sample.json output` | Runs the tutorial on a loopback fixture |
| `python3 cli.py samples/input.json --output scorecard.json --html reliability.html` | Scores the sample recording |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Grades the reference |

## Decision scoring rules
type: concepts
from: projects/decision-tradeoff-explorer/solution/main.ts, projects/decision-tradeoff-explorer/README.md

- **Benefit**: `(v - c.min) / (c.max - c.min)`.
- **Cost**: `(c.max - v) / (c.max - c.min)`.
- **Score**: sum of normalized value times weight, divided by the total weight.
- **Missing value**: the option is ineligible, also when that weight is 0.
- **Limit**: a hard limit. A cost above it or a benefit below it fails.
- **Ties**: ordered by option id.
- **Dominated**: another option is as good on all criteria and better on one.
- **Sensitivity**: sweeps one weight from 0 to 1 in `steps`.

## Web change brief
type: architecture
from: projects/web-change-brief/solution/main.go, projects/web-change-brief/README.md

```arch
node | in | 1,1 | before.html, after.html | or --fetch one URL | client
node | ex | 2,1 | ExtractBlocks() | readable text blocks | process
node | snap | 3,1 | NewSnapshot() | canonical URL, hash | process
node | cmp | 3,2 | Compare() | added, removed, unchanged | process
node | exp | 2,2 | ExportBrief() | index.html, changes.json | store
node | base | 1,2 | SaveSnapshot() | baseline.json | store
edge | in | ex | HTML
edge | ex | snap | blocks
edge | snap | cmp | two snapshots
edge | cmp | exp | brief
edge | exp | base | after
```

## A tutorial request block
type: annotated-code
lang: text
from: projects/api-tutorial-runner/solution/sample.json, projects/api-tutorial-runner/solution/main.ts

```text
# The tutorial holds JSON inside a request fence
{"id": "create-loan", "method": "POST", "path": "/loans",
 "status": 201,  # expected status, 100..599
 "capture": {"loanId": {"path": "id", "type": "number"}}}  # typed capture
{"id": "read-loan", "method": "GET",
 "path": "/loans/{{loanId}}",  # only declared variables
 "status": 200,
 "assert": {"bookName": "Neighborhood Trees"}}  # stale field, fails
```

## API tutorial runner steps
type: flow
from: projects/api-tutorial-runner/solution/main.ts, projects/api-tutorial-runner/solution/cli.ts

1. **extractRequests**: reads each request fence. It allows 20 steps at most.
2. **CLI**: starts a loopback server from `fixture` when there is no `endpoint`.
3. **runTutorial**: fills `{{name}}` from earlier captures. An undeclared name fails.
4. **runTutorial**: sends the request with no redirects, a timeout and a byte limit.
5. **runTutorial**: checks the status and each `assert` path, then stores captures.
6. **runTutorial**: after one failure, it skips the next steps and sends nothing.
7. **exportResults**: writes JUnit, HTML and `corrections.json` for each failure.

## Record and compare a local model
type: annotated-code
lang: bash
from: projects/local-model-eval-harness/README.md, projects/local-model-eval-harness/solution/record.py, projects/local-model-eval-harness/solution/cli.py

```bash
python3 record.py samples/cases.json \  # loopback HTTP endpoint only
  --endpoint http://127.0.0.1:11434/v1/chat/completions \
  --model <model> --revision <rev> --hardware <hw> \
  --output measured.json  # manifest, source, labels, records
python3 cli.py measured.json --baseline samples/input.json \
  --output compared.json  # rejects different dataset labels
python3 cli.py <recording> --min-accuracy <n>  # exit 2 below the gate
```

## Scorecard fields
type: concepts
from: projects/local-model-eval-harness/solution/main.py, projects/local-model-eval-harness/solution/cli.py, projects/local-model-eval-harness/README.md

- **accuracy**: exact answer after case folding and space cleanup, over all labels.
- **coverage**: predictions divided by labels.
- **ece**: confidence gap per bin, weighted by bin count.
- **p50_ms, p95_ms**: nearest rank latency percentiles.
- **dataset_sha256**: hash of the labels. A baseline must match it.
- **manifest**: needs `model`, `model_revision`, `prompt_revision`, `hardware` and `confidence_method`.

## Defaults and limits
type: defaults
from: projects/web-change-brief/solution/main.go, projects/api-tutorial-runner/solution/main.ts, projects/local-model-eval-harness/solution/main.py, projects/local-model-eval-harness/solution/cli.py, projects/decision-tradeoff-explorer/solution/main.ts

| Setting | Default | Note |
|---|---|---|
| `--out` | `web-change-output` | Web brief report folder |
| `MaxHTMLBytes` | `2_000_000` | 2 MB per page |
| `timeoutMs` | 1500 | Per request, 1 to 30000 |
| `maxBytes` | 65536 | Response byte limit |
| Request steps | 20 | At most per tutorial |
| `bins` | 5 | Calibration bins |
| `--min-accuracy` | 0 | Exit code 2 below it |
| Sensitivity `steps` | 10 | 1 to 100 |

## Error messages and fixes
type: troubleshooting
from: projects/decision-tradeoff-explorer/solution/main.ts, projects/web-change-brief/solution/main.go, projects/web-change-brief/README.md, projects/api-tutorial-runner/solution/main.ts, projects/api-tutorial-runner/README.md, projects/local-model-eval-harness/solution/cli.py

| Symptom | Cause | Fix |
|---|---|---|
| `chosen option must be eligible` | Option has a missing value or breaks a limit | Choose a scored option |
| `value outside declared range` | Value is not within `min` and `max` | Fix the value or the range |
| `Snapshots must refer to the same canonical URL` | Two different URLs | Compare snapshots of one page |
| `Live fetch requires --baseline JSON` | `--fetch` without a baseline | Run the saved-file mode first |
| `Baseline checksum mismatch` | Baseline file was edited | Make a new baseline |
| `Network endpoint requires explicit allowNetwork` | Endpoint is not loopback | Add `--allow-network` |
| `Earlier step failed; no request sent` | A previous step failed | Fix the first failed step |
| `cannot compare different datasets` | Labels differ from the baseline | Record the same cases again |

## Worked examples
type: qa
from: projects/decision-tradeoff-explorer/solution/fixtures/exhibition.json, projects/decision-tradeoff-explorer/solution/main.ts, projects/api-tutorial-runner/README.md, projects/api-tutorial-runner/solution/sample.json, projects/local-model-eval-harness/README.md

- **Which option wins the exhibition sample?** `pods` with 0.68. `open` has 0.67.
- **Why is `archive` not ranked?** Its `flow` value is null, so it is ineligible.
- **When does `open` win?** In the `access` sweep, at weight 0.6 or more.
- **Why does `read-loan` fail?** It asserts the stale field `bookName`.
- **What does the eval sample score?** 2/3 accuracy, full coverage, p95 of 200 ms.

## Tips
type: tips
from: projects/web-change-brief/README.md, projects/decision-tradeoff-explorer/README.md, projects/local-model-eval-harness/README.md, projects/api-tutorial-runner/README.md

- Use one filter policy for both snapshots. Filter phrases can hide changes.
- The baseline stays untouched unless you pass `--accept`.
- Weights are preferences, not probabilities.
- Reported confidence is model self-report. ECE changes with bins and sample count.
- The tutorial command succeeds after it writes evidence. Read the receipts.
