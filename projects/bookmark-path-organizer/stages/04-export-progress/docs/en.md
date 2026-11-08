# Export an editable collection and progress file

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Carry reading order and completion between a browser review and the next command.

## Public contract

```typescript
applyProgress(items: Reading[], value?: unknown): {items: Reading[]; progress: Progress}; renderCollection(items: Reading[], progress: Progress): string
```

Progress is `{schemaVersion:1,order:string[],completed:string[]}`. Order is a full permutation of current IDs; completed contains unique known IDs. The browser provides Move up/down, Read checkboxes and a JSON download. All visible text is escaped or assigned with textContent.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

If current IDs are `["a","b"]`, review `{schemaVersion:1,order:["b","a"],completed:["a"]}` renders b before a and checks a as read. `["a","a"]` is not a permutation and must fail.

```figure
pj-bookmark-path-organizer-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py bookmark-path-organizer --init my-bookmark-path-organizer
python3 scripts/project_test.py bookmark-path-organizer --stage 4 --path my-bookmark-path-organizer --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Reject stale progress rather than silently dropping unknown IDs. Escape closing-script text in embedded JSON.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-bookmark-path-organizer
node cli.ts sample.json output
```

A standalone reading-path page and bookmarks.json with retained original URLs. Open `output/report.html` and inspect the machine-readable companion files. Pass downloaded progress back with `node cli.ts sample.json resumed-output progress.json`; compare the new progress.json and the displayed order.

## Extend it

Merge progress across revised collections with an explicit conflict report.

Scope: The importer consumes the documented JSON folder tree, not arbitrary browser HTML. URL equality is document-oriented because fragments are removed; query strings remain significant. Ranking uses lexical tokens, not a remote model. Links are never fetched.
