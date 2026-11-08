# Render accessible definitions in context

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Insert keyboard-operable definitions without changing code or links.

## Public contract

```typescript
annotateLesson(html: string, terms: Term[]): {html: string; coverage: Coverage[]}
```

Use the documented bounded HTML fragment subset. Eligible text excludes a, pre and code ancestors. Native buttons expose definitions by keyboard and pointer. Each button and its initially hidden definition use span wrappers, so annotations remain valid inside paragraphs, headings and emphasis. Keep aria-expanded synchronized with the definition's hidden state when toggling. Coverage is one `{id,term,count}` per glossary term, including zero matches. Entities split matching spans. Require balanced nesting and quoted allowed attributes.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

For `<p>Map</p><code>map</code><a href="https://example.invalid">map</a>`, coverage is 1. Only the paragraph receives an inline disclosure button and definition span; the code and link remain verbatim.

```figure
pj-glossary-hovercard-publisher-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py glossary-hovercard-publisher --init my-glossary-hovercard-publisher
python3 scripts/project_test.py glossary-hovercard-publisher --stage 3 --path my-glossary-hovercard-publisher --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Allow p, h1-h4, ul, ol, li, em, strong, span, div, section, article, blockquote, code, pre, a, br and hr. Attributes: class,id,title,lang and href on a. HTTP(S) and local fragment links only. Reject scripts, events, unquoted attributes and malformed nesting. This is a constrained parser, not a general HTML sanitizer.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-glossary-hovercard-publisher
node cli.ts sample.json output
```

An annotated HTML lesson, glossary.json and a term-coverage report. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Use a maintained HTML parser if you extend beyond this explicitly tested subset.

Scope: Input HTML is a balanced fragment in a deliberately small subset, not arbitrary web-page HTML. Phrases never cross elements or entity boundaries. Native buttons supply keyboard interaction; glossary quality remains an editorial decision.
