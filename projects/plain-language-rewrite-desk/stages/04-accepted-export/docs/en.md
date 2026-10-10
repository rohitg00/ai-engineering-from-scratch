# Export accepted revisions and a change record

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Apply only explicitly accepted, fact-checked proposals and retain all other original text.

## Public contract

```typescript
exportRevisions(comparisons,value?):{markdown,changeRecord,decisions,unresolved}; renderDesk(comparisons,state):string
```

Review `{schemaVersion:1,decisions:[{id,decision:"accept"|"reject"|"pending",candidate}]}` binds decisions to exact candidate text. Unknown, duplicated or stale decisions fail. An accept with issues fails. Pending and rejected paragraphs keep original text. Export accepted.md, changes.md, versioned decisions and pending IDs.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Accept p1 and reject p2 in the interface, download decisions, and rerun. accepted.md contains the shorter first paragraph and the unchanged second original. A modified review that accepts p2 is rejected by the CLI.

```figure
pj-plain-language-rewrite-desk-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py plain-language-rewrite-desk --init my-plain-language-rewrite-desk
python3 scripts/project_test.py plain-language-rewrite-desk --stage 4 --path my-plain-language-rewrite-desk --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A previous approval cannot carry over to changed proposal text. Rechecking on CLI import protects the boundary even if a downloaded file is edited.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-plain-language-rewrite-desk
node cli.ts sample.json output
```

Accepted Markdown, a paragraph-level HTML comparison and revision-decisions.json. Open `output/report.html` and inspect the machine-readable companion files. Pass the downloaded revision-decisions.json as the third CLI argument. accepted.md is a complete document: accepted paragraphs use revisions; pending/rejected paragraphs retain originals.

## Extend it

Record reviewer identity and timestamps supplied by the author.

Scope: The baseline uses deterministic phrase substitutions and recorded author proposals. No live model adapter is shipped. Numeric, protected-term and definition checks are lexical safeguards, not a proof that every fact or nuance is preserved. The author reviews meaning.
