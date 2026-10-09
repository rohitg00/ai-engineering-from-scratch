# Generate bounded translation proposals

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Bound recorded translation proposals and report contract problems before review.

## Public contract

```typescript
proposeTranslations(messages:Message[],recorded:unknown,locale:string):Proposal[]
```

Validate locale with Intl.Locale. Recorded proposals are keyed strings, each 1..2000 characters. Unknown keys fail; absent keys produce a null translation and a missing-proposal issue. Preserve placeholders exactly as a multiset and expose syntax/mismatch issues. Return `{key,translation,issues,needsContext}`.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The sample Spanish proposal for borrow.count omits {count}, so it receives Placeholder multiset changed. borrow.return has no placeholder issue but remains ambiguous because Return could describe an action or navigation.

```figure
pj-ui-string-localization-workbench-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py ui-string-localization-workbench --init my-ui-string-localization-workbench
python3 scripts/project_test.py ui-string-localization-workbench --stage 2 --path my-ui-string-localization-workbench --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A proposal is not approved automatically. Missing placeholders are visible failures even if the translation reads naturally.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-ui-string-localization-workbench
node cli.ts sample.json output
```

Reviewed locale JSON, an interactive message preview and unresolved-strings.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add a real provider adapter that records provider/version and never bypasses review.

Scope: Translations are recorded original proposals supplied in the input, not a live provider integration or a quality guarantee. This teaching subset supports simple named placeholders, not ICU messages. Locale tags affect preview language metadata; reviewers judge translation meaning.
