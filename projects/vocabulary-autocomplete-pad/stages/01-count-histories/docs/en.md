# Tokenize a corpus and count word histories

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Count words and one- or two-word histories without crossing sentence boundaries.

## Public contract

```typescript
tokenize(text: string): string[]; train(corpus: unknown): Model
```

Input corpus is `{id:string,text:string}[]` with unique nonempty ids. Normalize NFC and lowercase. Tokens contain Unicode letters/numbers and internal apostrophes. Split sentences at period, question mark, exclamation mark or newline. Model `{schemaVersion:1,words,histories,sources}` maps tokens to counts, JSON-encoded histories to next-word counts and words to source ids.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Corpus `Garden club shares seeds. Garden club grows herbs.` counts garden=2, club=2 and records `["garden","club"] -> {shares:1,grows:1}`. No transition is recorded from seeds to garden.

```figure
pj-vocabulary-autocomplete-pad-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --init my-vocabulary-autocomplete-pad
python3 scripts/project_test.py vocabulary-autocomplete-pad --stage 1 --path my-vocabulary-autocomplete-pad --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Use dictionaries safe for tokens such as constructor. Do not learn a transition across sentences. Sources must stay inspectable.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-vocabulary-autocomplete-pad
node cli.ts sample.json output
```

A local autocomplete writing page and vocabulary-model.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Track paragraph provenance in addition to source identity.

Scope: This is a transparent count-based local language model, not a hosted LLM. It suggests a single next token with up to two tokens of context. The browser editor operates at the end of input. No provider adapter is implied.
