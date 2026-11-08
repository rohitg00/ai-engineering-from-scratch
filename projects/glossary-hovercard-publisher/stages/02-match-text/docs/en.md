# Match phrases inside eligible text nodes

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Locate the longest eligible phrase at each word boundary.

## Public contract

```typescript
matchTerms(text: string, terms: Term[]): Match[]
```

Return ordered nonoverlapping `{termId,start,end,text}` with zero-based UTF-16 offsets and exclusive end. Match case-insensitively. Word characters are Unicode letters, numbers and underscore. Prefer longest phrase at each position. HTML parsing comes in the next stage.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

In `Map scale, then map`, offsets 0..9 select map scale and 16..19 select map. A standalone map definition must not consume the start of the longer phrase.

```figure
pj-glossary-hovercard-publisher-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py glossary-hovercard-publisher --init my-glossary-hovercard-publisher
python3 scripts/project_test.py glossary-hovercard-publisher --stage 2 --path my-glossary-hovercard-publisher --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

The word map must not match inside mapping. map scale beats map at the same start. Keep original display case.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-glossary-hovercard-publisher
node cli.ts sample.json output
```

An annotated HTML lesson, glossary.json and a term-coverage report. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add locale-specific segmentation and explain changed boundaries.

Scope: Input HTML is a balanced fragment in a deliberately small subset, not arbitrary web-page HTML. Phrases never cross elements or entity boundaries. Native buttons supply keyboard interaction; glossary quality remains an editorial decision.
