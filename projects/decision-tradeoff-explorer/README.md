# Decision Tradeoff Explorer

Help a community team compare practical project options using a user-supplied criteria table and supporting notes. Apply explicit constraints, weighted scores and sensitivity analysis, keep missing values visible, and export an interactive HTML decision board and a reusable decision record.

Standard libraries only. Four stages, approximately eight hours. TypeScript implementations are exercised by the grader.

## Build it

1. [Declare options and evidence](stages/01-declare-evidence/docs/en.md)
2. [Compute comparable scores](stages/02-normalize-and-score/docs/en.md)
3. [Explore sensitivity and dominance](stages/03-sweep-preferences/docs/en.md)
4. [Export the chosen scenario](stages/04-export-board/docs/en.md)

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --init /tmp/decision-tradeoff-explorer-work
python3 scripts/project_test.py decision-tradeoff-explorer --stage 1 --path /tmp/decision-tradeoff-explorer-work --strict
python3 scripts/project_test.py decision-tradeoff-explorer --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run your own decision

```bash
cd projects/decision-tradeoff-explorer/solution
node --experimental-strip-types cli.ts fixtures/exhibition.json /tmp/decision-board
python3 -m http.server 8123 --directory /tmp/decision-board
```

Open localhost:8123, change a criterion weight, choose an eligible option and download decision-record.json. Stop the temporary server after inspection. The CLI is terminating; the preview server is an explicit separate command. Node 22.18+ is required.

The input schema and exact public function contracts are in the stages. Scores use fixed, declared ranges and nonnegative normalized weights. Missing values remain visible and make an option ineligible even when that criterion has zero weight. Constraints are hard limits. Ties are ordered by ID. Unknown values are never silently imputed.

The exported CSV retains every original source note. The version-1 JSON includes the full decision input and selected weights, so another program can recompute it with `score({criteria:receipt.criteria,options:receipt.options},receipt.weights)`. HTML downloads preserve the current user-selected scenario. The browser executes no network requests and scores authored or user-supplied evidence; it does not infer preference truth or make a decision on the user's behalf.

[Node TypeScript support](https://nodejs.org/api/typescript.html) describes the native type-stripping runtime.

## Completion evidence

```bash
python3 scripts/project_test.py decision-tradeoff-explorer --all --path /tmp/decision-tradeoff-explorer-work --strict --report /tmp/decision-tradeoff-explorer-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
