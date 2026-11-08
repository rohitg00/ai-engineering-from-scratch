# Normalize links and explain duplicate groups

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Explain exactly why two saved links point at the same document.

## Public contract

```typescript
normalizeURL(value: string): string; groupDuplicates(items: Bookmark[]): Group[]
```

Use the WHATWG URL representation: lowercase host, remove default port and remove fragment. Retain the query and its order, path case and trailing slash. Return groups `{url,items,reason}` in first-seen order with copied original records.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

`https://EXAMPLE.invalid:443/maps#intro` and `https://example.invalid/maps#scale` normalize to `https://example.invalid/maps`. `?view=print` remains a separate group. The sample imports 12 saved records into 11 document groups.

```figure
pj-bookmark-path-organizer-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py bookmark-path-organizer --init my-bookmark-path-organizer
python3 scripts/project_test.py bookmark-path-organizer --stage 2 --path my-bookmark-path-organizer --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A tracking-looking query may change a page. Do not remove query parameters or merge HTTP with HTTPS. Reject credentials.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-bookmark-path-organizer
node cli.ts sample.json output
```

A standalone reading-path page and bookmarks.json with retained original URLs. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an explicit user-approved tracking-parameter policy with its own receipt.

Scope: The importer consumes the documented JSON folder tree, not arbitrary browser HTML. URL equality is document-oriented because fragments are removed; query strings remain significant. Ranking uses lexical tokens, not a remote model. Links are never fetched.
