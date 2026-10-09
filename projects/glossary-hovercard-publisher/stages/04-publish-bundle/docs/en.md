# Export the lesson and reusable glossary bundle

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Ship one standalone lesson with the exact glossary that produced it.

## Public contract

```typescript
publishGlossary(lesson: string, terms: Term[]): {html: string; glossary: Term[]; coverage: Coverage[]}
```

Return a complete HTML page, copied glossary and coverage. The page includes the real annotated lesson and a glossary download button. Wire each term button to toggle its sibling definition span and aria-expanded; native button activation supports Enter and Space. JSON exports must roundtrip through validateGlossary. Definitions and embedded JSON must not introduce executable HTML.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Publish the sample, open the resulting lesson, use Tab to focus map scale, and press Enter. The exported glossary validates unchanged and the coverage report counts both canonical phrases and aliases.

```figure
pj-glossary-hovercard-publisher-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py glossary-hovercard-publisher --init my-glossary-hovercard-publisher
python3 scripts/project_test.py glossary-hovercard-publisher --stage 4 --path my-glossary-hovercard-publisher --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A definition containing angle brackets is text. The complete page must retain untouched code and links.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-glossary-hovercard-publisher
node cli.ts sample.json output
```

An annotated HTML lesson, glossary.json and a term-coverage report. Open `output/report.html` and inspect the machine-readable companion files. The CLI saves glossary.json as a plain Term array. Reuse it as the next input file's glossary field or call validateGlossary(JSON.parse(...)) from another editor.

## Extend it

Add a review queue for terms with zero coverage.

Scope: Input HTML is a balanced fragment in a deliberately small subset, not arbitrary web-page HTML. Phrases never cross elements or entity boundaries. Native buttons supply keyboard interaction; glossary quality remains an editorial decision.
