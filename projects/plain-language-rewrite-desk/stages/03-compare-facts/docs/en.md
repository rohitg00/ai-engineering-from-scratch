# Compare omissions, numbers and readability measures

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Compare observable editing changes and surface recorded fact violations.

## Public contract

```typescript
measures(text:string):{words,sentences,averageWords,longWords}; compareParagraphs(paragraphs,proposals,definitions?):Comparison[]
```

Require exactly one proposal per paragraph. Count Unicode word tokens, punctuation-separated sentences, mean words/sentence rounded to 2 decimals and words longer than 8 characters. Issues report changed numeric multiset, missing exact protected term, and missing case-insensitive required definition phrase. Return original/candidate, before/after measures and issues.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The sample second proposal changes 15% to 10% and drops the exact required definition phrase. Both issues stay visible even though the sentence-length measure decreases.

```figure
pj-plain-language-rewrite-desk-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py plain-language-rewrite-desk --init my-plain-language-rewrite-desk
python3 scripts/project_test.py plain-language-rewrite-desk --stage 3 --path my-plain-language-rewrite-desk --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A lower average is not proof of comprehension. A numeric literal changed from 15% to 10% must block acceptance even if the prose looks simpler.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-plain-language-rewrite-desk
node cli.ts sample.json output
```

Accepted Markdown, a paragraph-level HTML comparison and revision-decisions.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add a human meaning checklist without pretending lexical checks cover every omission.

Scope: The baseline uses deterministic phrase substitutions and recorded author proposals. No live model adapter is shipped. Numeric, protected-term and definition checks are lexical safeguards, not a proof that every fact or nuance is preserved. The author reviews meaning.
