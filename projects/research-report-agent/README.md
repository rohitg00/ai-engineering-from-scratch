# Research Report Agent

Level 2, Builder. About 20 hours. Rust, Python and TypeScript standard libraries. Runs offline. Requires Python 3.10+, rustc and Node 22.18+.

Turn a question and a folder of documents into a report where every sentence can be checked. You build the pipeline that deep research tools run: search, snippet extraction, planning, cited writing, claim verification, publishing and evaluation.

```figure
pj-rra-pipeline
```

Rust owns ranking, Python owns evidence and orchestration, and TypeScript owns publication. Both language boundaries use inspectable JSON. The replay model keeps tests deterministic; a live model is optional.

## What you end up with

```bash
python3 projects/research-report-agent/solution/run_report.py \
  "How does a secrets proxy protect API keys from prompt injection?" --out out/ --code my-report-agent
```

- `out/report.html`: sections with numbered footnotes. Every footnote quotes the exact source sentence and links the original page.
- `out/report.json`: the versioned evidence contract consumed by the TypeScript viewer.
- `out/trace.json`: run id, each step with timings, counts, budget use and the terminal state (`completed`, `needs_review` or `failed`).
- A scorecard on checked-in public evaluation fixtures, with component metrics you can compare and share.

## Stages

| # | Stage | You implement | Level |
|---|---|---|---|
| 1 | Search the corpus | `search/main.rs`, Python adapter (BM25) | starter |
| 2 | Extract snippets you can cite | `snippets.py` (sentence spans, offsets) | starter |
| 3 | Plan the research | `planner.py`, `model.py` (replay cassette, fallback) | core |
| 4 | Write only from evidence | `citations.py`, `writer.py` | core |
| 5 | Verify every claim | `critic.py` (support rules, budget, terminal states) | core |
| 6 | Publish the report | `publish.py`, `pipeline.py`, `viewer/render.ts` | core |
| 7 | Score the public fixtures | `evaluate.py` | stretch |

## Start

```bash
python3 scripts/project_test.py research-report-agent --init my-report-agent
python3 scripts/project_test.py research-report-agent --stage 1 --path my-report-agent
```

Read `stages/01-search-the-corpus/docs/en.md`, fill in the stubs in `my-report-agent/report_agent/`, and rerun until stage 1 passes. Each later stage reruns every earlier stage, so a regression shows up immediately.

Stuck? The reference implementation is in `solution/`. Read it after you have tried, not before.

## Folder map

```text
project.json        metadata the site and the grader read
fixtures/corpus/    12 original concept notes with supporting official sources
fixtures/questions.json       development questions
fixtures/cassettes/planner.json  recorded model replies for stage 3
heldout/            public evaluation questions and poisoned drafts (legacy folder name)
stages/NN-*/docs/en.md        the lesson for each stage
stages/NN-*/starter/          stubs copied by --init
stages/NN-*/tests/            the tests the grader runs
solution/           reference implementation and run_report.py
```

## Use it on your own documents

Point `--corpus` at any folder of markdown files that start with `title:`, `source_url:` and `published:` lines, then a blank line, then the body.

## Verified reference output

The secrets-proxy example produces 4 sections, 10 sentences, no dropped claims and state `completed`. Its footnotes show exact evidence on hover or keyboard focus, and its expandable trace shows the five pipeline steps. The reference baseline scores 87.5 / 100 on the six checked-in public evaluation questions. The demo repeats question h4 from that file, so this is a reproducible fixture score rather than evidence from an unseen evaluation. Lexical verification does not establish real-world truth.


## Inspect a source update

The original Orchard corpus is fictional operational documentation. Run both revisions with the same question and inspect `orchard-after/changes.json`.

```bash
python3 projects/research-report-agent/solution/run_report.py "How long do Orchard guest tokens last?" --code projects/research-report-agent/solution --corpus projects/research-report-agent/examples/orchard/before --out orchard-before
python3 projects/research-report-agent/solution/run_report.py "How long do Orchard guest tokens last?" --code projects/research-report-agent/solution --corpus projects/research-report-agent/examples/orchard/after --compare orchard-before/report.json --out orchard-after
```

The default uses deterministic planning and extractive writing. --model replay needs --cassette. --model live uses RRA_LLM_BASE_URL, RRA_LLM_MODEL and optional RRA_LLM_API_KEY for planning only. Live service behavior requires a separate run with caller credentials. Public fixture scores do not measure unseen generalization.
