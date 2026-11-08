# Validate terms, aliases and original definitions

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Build a reviewed dictionary with unambiguous phrase identities.

## Public contract

```typescript
validateGlossary(value: unknown): Term[]
```

A Term is `{id,term,aliases:string[],definition}`; aliases default to []. IDs match `[a-z][a-z0-9-]*`. Require nonempty text and unique case-insensitive phrases across every canonical term and alias. Return copied records.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Term `map scale` with alias `scale ratio` yields two phrases pointing at the same id. Adding another term with alias `MAP SCALE` must fail before annotation.

```figure
pj-glossary-hovercard-publisher-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py glossary-hovercard-publisher --init my-glossary-hovercard-publisher
python3 scripts/project_test.py glossary-hovercard-publisher --stage 1 --path my-glossary-hovercard-publisher --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Do not let two definitions silently claim the same alias. Reject a string where an aliases array is expected.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-glossary-hovercard-publisher
node cli.ts sample.json output
```

An annotated HTML lesson, glossary.json and a term-coverage report. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add definition review timestamps without changing matching behavior.

Scope: Input HTML is a balanced fragment in a deliberately small subset, not arbitrary web-page HTML. Phrases never cross elements or entity boundaries. Native buttons supply keyboard interaction; glossary quality remains an editorial decision.
