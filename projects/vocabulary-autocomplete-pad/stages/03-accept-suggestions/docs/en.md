# Accept suggestions in a writing pad

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Distinguish an unfinished token from a completed word before inserting a suggestion.

## Public contract

```typescript
completeText(model: Model, text: string, limit?: number): {prefix:string;history:string[];suggestions:Suggestion[]}; acceptSuggestion(text:string,prefix:string,word:string):string
```

Use only the text after the final sentence boundary. If it ends in a word character/apostrophe, pop the final token as prefix; otherwise prefix is empty. History is the last two complete tokens. Acceptance replaces the exact suffix prefix and adds one space. Require a normalized single-token suggestion.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

`Garden club sh` becomes prefix sh and history [garden,club]. Accepting shares produces `Garden club shares `, preserving earlier text. A space after club means an empty prefix.

```figure
pj-vocabulary-autocomplete-pad-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --init my-vocabulary-autocomplete-pad
python3 scripts/project_test.py vocabulary-autocomplete-pad --stage 3 --path my-vocabulary-autocomplete-pad --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

After a period, history resets. Do not append a completion to the prefix instead of replacing it. Reject stale prefixes.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-vocabulary-autocomplete-pad
node cli.ts sample.json output
```

A local autocomplete writing page and vocabulary-model.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Support caret-position editing rather than the documented end-of-input position.

Scope: This is a transparent count-based local language model, not a hosted LLM. It suggests a single next token with up to two tokens of context. The browser editor operates at the end of input. No provider adapter is implied.
