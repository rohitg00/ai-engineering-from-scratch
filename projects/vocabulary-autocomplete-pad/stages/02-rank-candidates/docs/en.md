# Rank prefix and next-word candidates

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Rank candidates by the longest observed history and show the underlying count.

## Public contract

```typescript
suggest(model: Model, prefix: string, history?: string[], limit?: number): Suggestion[]
```

Normalize the prefix; filter words by startsWith. For each word use the longest matching suffix history (2 then 1), otherwise its unigram count. Sort by order descending, count descending, then lexical word. Return `{word,score,order,count,sources}`; score is order * 1000000 + count for display, sorting uses separate order/count. limit defaults to 5 and must be an integer 0..50.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

For prefix `s` after history `["garden","club"]`, shares with order 2/count 1 precedes seed with order 0/count 20. A low raw count can still be stronger conditional evidence.

```figure
pj-vocabulary-autocomplete-pad-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --init my-vocabulary-autocomplete-pad
python3 scripts/project_test.py vocabulary-autocomplete-pad --stage 2 --path my-vocabulary-autocomplete-pad --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Unseen history backs off. A prefix with no candidates returns []; no remote completion is fabricated.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-vocabulary-autocomplete-pad
node cli.ts sample.json output
```

A local autocomplete writing page and vocabulary-model.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add smoothing while preserving raw evidence counts.

Scope: This is a transparent count-based local language model, not a hosted LLM. It suggests a single next token with up to two tokens of context. The browser editor operates at the end of input. No provider adapter is implied.
