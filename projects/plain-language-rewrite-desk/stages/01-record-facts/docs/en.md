# Segment prose and record protected terms and facts

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Separate paragraphs while recording the facts later revisions must preserve.

## Public contract

```typescript
segmentProse(text:string,protectedTerms?:string[]):Paragraph[]
```

Split at blank lines, trim each nonempty paragraph, assign p1,p2,... Return `{id,text,numbers,protectedTerms}`. Numbers are sorted literal numeric expressions with optional percent or common units km,cm,mm,ms,kg,m,s. Protected terms are case-sensitive exact strings present in that paragraph.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The paragraph `A projection uses 15%.` records numbers ["15%"] and protectedTerms ["projection"]. Blank lines create new identities; line wrapping alone does not.

```figure
pj-plain-language-rewrite-desk-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py plain-language-rewrite-desk --init my-plain-language-rewrite-desk
python3 scripts/project_test.py plain-language-rewrite-desk --stage 1 --path my-plain-language-rewrite-desk --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Repeated numeric occurrences matter; use a multiset, not only a set. These checks cannot establish semantic equivalence.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-plain-language-rewrite-desk
node cli.ts sample.json output
```

Accepted Markdown, a paragraph-level HTML comparison and revision-decisions.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add date and identifier extractors with explicit tests.

Scope: The baseline uses deterministic phrase substitutions and recorded author proposals. No live model adapter is shipped. Numeric, protected-term and definition checks are lexical safeguards, not a proof that every fact or nuance is preserved. The author reviews meaning.
