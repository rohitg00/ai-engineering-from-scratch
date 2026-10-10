# Read message keys, placeholders and context

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Record stable keys and exact interpolation contracts before translation.

## Public contract

```typescript
placeholders(text:string):string[]; readCatalog(value:unknown):Message[]
```

Catalog maps keys to `{text,context,ambiguous?}`. Keys start with a letter and contain letters/numbers/dot/underscore/hyphen; reserved prototype names fail. Require nonempty text/context. Support only simple `{name}` placeholders, returning a sorted multiset including duplicates. Reject unmatched/nested braces and ICU plural syntax.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Message count has text `You selected {count} tools` and context describing its summary position. The stored placeholder multiset is ["{count}"]. A translation that drops the count cannot be approved.

```figure
pj-ui-string-localization-workbench-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py ui-string-localization-workbench --init my-ui-string-localization-workbench
python3 scripts/project_test.py ui-string-localization-workbench --stage 1 --path my-ui-string-localization-workbench --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Two occurrences of {count} require two translated occurrences. Context is required for short ambiguous UI text.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-ui-string-localization-workbench
node cli.ts sample.json output
```

Reviewed locale JSON, an interactive message preview and unresolved-strings.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an ICU parser as a distinct extension with its own contracts.

Scope: Translations are recorded original proposals supplied in the input, not a live provider integration or a quality guarantee. This teaching subset supports simple named placeholders, not ICU messages. Locale tags affect preview language metadata; reviewers judge translation meaning.
