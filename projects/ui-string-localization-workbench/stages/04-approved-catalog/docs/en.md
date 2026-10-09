# Export approved locale and unresolved questions

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Export only explicitly approved translations with their context checks.

## Public contract

```typescript
reviewTranslations(messages,proposals,value?):{catalog,unresolved,review}; renderWorkbench(messages,proposals,state,locale,values?):string
```

Review `{schemaVersion:1,decisions:{[key]:{decision:"pending"|"approve"|"reject",translation,acknowledgeContext:boolean}}}` binds each decision to exact proposal text. Approval requires no issues and a context acknowledgement for ambiguous strings. Pending/rejected keys remain in unresolved; they are omitted from locale.json. Browser preview has variable editing and a downloadable review.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Approve borrow.hello and acknowledge context before approving borrow.return. The exported locale contains only those two keys; borrow.count remains unresolved until its recorded proposal is corrected and reviewed again.

```figure
pj-ui-string-localization-workbench-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py ui-string-localization-workbench --init my-ui-string-localization-workbench
python3 scripts/project_test.py ui-string-localization-workbench --stage 4 --path my-ui-string-localization-workbench --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Revalidate downloaded decisions in the CLI. Stale translations and edited approval files must not bypass placeholders or ambiguity.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-ui-string-localization-workbench
node cli.ts sample.json output
```

Reviewed locale JSON, an interactive message preview and unresolved-strings.json. Open `output/report.html` and inspect the machine-readable companion files. Run `node cli.ts sample.json reviewed-output locale-review.json`; consume locale.json as a key-to-string catalog. Unapproved keys remain absent, with reasons in unresolved-strings.json.

## Extend it

Use the unresolved queue to plan the next editorial pass.

Scope: Translations are recorded original proposals supplied in the input, not a live provider integration or a quality guarantee. This teaching subset supports simple named placeholders, not ICU messages. Locale tags affect preview language metadata; reviewers judge translation meaning.
