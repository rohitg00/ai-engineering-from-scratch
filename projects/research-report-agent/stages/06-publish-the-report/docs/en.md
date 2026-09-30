# Publish the report

> A readable report and a machine-readable trace serve different readers.

**Type:** Build
**Languages:** Python, TypeScript
**Stage:** 6 of 7 (core)
**Time:** ~2 hours

## What you build

Python runs the pipeline and serializes `report.json` plus `trace.json`. `viewer/render.ts` consumes the JSON and produces a self-contained `report.html`. The viewer is actual TypeScript with interfaces for sections, sentences, snippets, documents and traces. Use Node 22.18 or newer with built-in type stripping; the verified local runtime was Node 25.6.1.

```figure
pj-rra-publish
```

A JSON boundary forces the publishing contract to survive serialization. Passing a Python object directly into a template would not test that boundary. TypeScript's type annotations document the contract, while runtime validation rejects malformed files because types do not validate JSON.

## Keep the evidence contract intact

```json
{
  "schema_version": 1,
  "question": "How does a secrets proxy protect credentials?",
  "sections": [],
  "snippets": {},
  "documents": [],
  "trace": null
}
```

Every rendered citation must resolve to a snippet and a document. Verify that the original document slice equals the snippet text. Python offsets count Unicode code points; JavaScript string slices count UTF-16 units. Use `[...source.text].slice(start, end).join('')` so a preceding emoji does not shift the evidence span.

Number footnotes by first appearance. Reusing `S4` in two sentences should produce two reference links and one footnote. Tooltip ids must remain unique even when the footnote is reused. Escape question text, section headings, source titles, snippets and trace details. Restrict source links to HTTP or HTTPS; HTML escaping alone does not neutralize a `javascript:` URL.

## Make the artifact usable

A citation reveals its exact source sentence on hover or keyboard focus. Clicking it jumps to the numbered note. Native `<details>` exposes the run trace without requiring a client framework or JavaScript. The page honors light and dark color preferences and fits a phone viewport.

The report still works as a local file. Its interaction uses HTML and CSS, so there is no network service or package installation required to read it.

## Trace the pipeline

Run and charge these steps in order: `index`, `plan`, `gather`, `write`, `verify`. Each record contains a name, elapsed milliseconds and structured details. Preserve `run_id`, `question`, `started_at`, `counts`, `budget` and `terminal_state` in the trace.

A budget exhaustion appends `budget_exceeded`, produces state `failed`, and renders the evidence collected so far. Distinguish a useful failed artifact from a renderer crash. Empty reports are valid when a run could not collect supported claims.

## Your task

Complete the pipeline, Python payload serializer and process adapter, plus the typed renderer. `run_pipeline` returns `(report, trace, html)` and writes all three files when an output directory is supplied.

```bash
python3 scripts/project_test.py research-report-agent --stage 6 --path my-report-agent
python3 projects/research-report-agent/solution/run_report.py \
  "How does a secrets proxy protect API keys from prompt injection?" \
  --code my-report-agent --out out
node my-report-agent/viewer/render.ts out/report.json out/report.html
open out/report.html
```

## What you should see

The reference command produces state `completed`, 4 sections and 10 sentences with 0 dropped. The directory contains `report.json`, `report.html` and `trace.json`. Hover or focus `[1]` to see an exact quote, then open the run trace to inspect all five steps. Timings and run ids differ between executions.

Stage 6 has 7 Node tests and 7 Python integration tests. They check Unicode offsets, escaping, unsafe URLs, duplicate citations, dangling evidence and a tiny-budget failure.

## Check yourself

Why must JSON receive runtime validation even when the renderer is typed? Why do the Python and JavaScript offsets disagree after an emoji? What would an engineer need from the trace when a report has no sections?

## Going further

Add a print stylesheet with page-aware footnotes, or render dropped claims in a separate review section. Keep unsupported claims visibly distinct from published evidence.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 5](../../05-verify-every-claim/docs/en.md) first.

Publish one versioned report payload for the TypeScript viewer and the separate report judge. The Orchard before/after walkthrough writes changes.json listing removed claims, added claims and changed source spans.

```text
report.json -> viewer + judge
60-minute sentence -> removed_claims
15-minute sentence -> added_claims
```

## Build and inspect

Validate source slices again at publication. Escape text before HTML rendering; source content is data, not executable markup.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 6 --path learning-artifacts/research-report-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How can a reviewer distinguish a changed claim from unchanged wording supported by changed evidence?
