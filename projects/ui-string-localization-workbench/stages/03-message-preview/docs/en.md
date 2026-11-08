# Preview strings with supplied interpolation values

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Render interpolation as text so reviewers can see real layout content.

## Public contract

```typescript
previewMessage(template:string,values:Record<string,string|number>):string
```

Replace each supported placeholder with a supplied own-property value. Keep missing values as the original {name} token. Return plain text; HTML callers must use textContent or escaping. Validate placeholder syntax first.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

With values `{count:3,name:"Lina"}`, `Hola, {name}` previews as Hola, Lina. A missing name stays visible as {name}. Changing the preview values never changes the stored translation.

```figure
pj-ui-string-localization-workbench-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py ui-string-localization-workbench --init my-ui-string-localization-workbench
python3 scripts/project_test.py ui-string-localization-workbench --stage 3 --path my-ui-string-localization-workbench --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A value containing markup must remain visible text in the interface. Do not use JavaScript evaluation or inherited object properties.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-ui-string-localization-workbench
node cli.ts sample.json output
```

Reviewed locale JSON, an interactive message preview and unresolved-strings.json. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Measure overflow using real browser dimensions for a chosen product component.

Scope: Translations are recorded original proposals supplied in the input, not a live provider integration or a quality guarantee. This teaching subset supports simple named placeholders, not ICU messages. Locale tags affect preview language metadata; reviewers judge translation meaning.
