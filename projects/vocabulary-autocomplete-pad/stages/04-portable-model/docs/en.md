# Export the learned model and editor function

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Validate a portable model and ship a pad that calls the same suggestion functions.

## Public contract

```typescript
importModel(value: unknown): Model; renderPad(model: Model, initial?: string): string
```

Import checks schema version, positive integer counts, normalized words, source arrays, history-key length and conditional counts bounded by unigram counts. Return a copy. The pad shows evidence on each suggestion and exports the exact model plus writing text.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Export the model, parse it through importModel and call suggest again. The candidate list should be identical; JSON transport must not change token counts or source evidence.

```figure
pj-vocabulary-autocomplete-pad-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --init my-vocabulary-autocomplete-pad
python3 scripts/project_test.py vocabulary-autocomplete-pad --stage 4 --path my-vocabulary-autocomplete-pad --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Treat imported JSON as data. Embedded script delimiters must be escaped; use DOM textContent for suggestions.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-vocabulary-autocomplete-pad
node cli.ts sample.json output
```

A local autocomplete writing page and vocabulary-model.json. Open `output/report.html` and inspect the machine-readable companion files. Use `importModel(JSON.parse(modelFile))`, then `suggest(model,"se",["shares","native"])`. To reuse through the CLI, pass `{model: exportedModel, text:"Garden club sh"}` as input JSON.

## Extend it

Package suggest as an editor plugin.

Scope: This is a transparent count-based local language model, not a hosted LLM. It suggests a single next token with up to two tokens of context. The browser editor operates at the end of input. No provider adapter is implied.
