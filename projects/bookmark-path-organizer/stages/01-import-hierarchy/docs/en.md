# Import bookmarks with their original hierarchy

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Flatten a folder tree while keeping original URLs and every ancestor folder.

## Public contract

```typescript
importBookmarks(input: unknown): Bookmark[]
```

Input is an array of folders `{title,children}` or bookmarks `{id,title,url,notes?}`. Return `{id,title,url,notes,folders:string[]}`. IDs must be unique; notes default to an empty string. Validate absolute HTTP(S) URLs without credentials. Limit folder nesting to 32. Stage 1 may validate URLs directly; normalizeURL is introduced in stage 2.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

A folder `Maps / Basics` containing bookmark `a` produces `folders:["Maps","Basics"]`; the original `https://EXAMPLE.invalid/#intro` remains verbatim. An empty input returns `[]`.

```figure
pj-bookmark-path-organizer-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py bookmark-path-organizer --init my-bookmark-path-organizer
python3 scripts/project_test.py bookmark-path-organizer --stage 1 --path my-bookmark-path-organizer --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Reject duplicate IDs, missing titles, non-string notes and unsafe protocols. Recurse with a copied ancestor array, not one shared array.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-bookmark-path-organizer
node cli.ts sample.json output
```

A standalone reading-path page and bookmarks.json with retained original URLs. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an import adapter for one browser export format while keeping this typed boundary.

Scope: The importer consumes the documented JSON folder tree, not arbitrary browser HTML. URL equality is document-oriented because fragments are removed; query strings remain significant. Ranking uses lexical tokens, not a remote model. Links are never fetched.
