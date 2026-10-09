# Rank topics and assemble a reading path

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Rank a reading collection with visible keyword evidence.

## Public contract

```typescript
readingPath(groups: Group[], topics: Record<string,string[]>): Reading[]
```

Match lowercase Unicode word tokens. Each unique keyword scores 3 if any group title contains it and 1 if any notes contain it; duplicate bookmarks do not multiply scores. Sum topic scores, sort descending then by id. Return `{id,title,url,originals,folders,topics,score,evidence}` using the first saved record as identity. Topic keywords must be nonempty strings and are intended as single tokens.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

For topic `Mapping:["map"]`, title `Map basics` adds 3; notes `Read this map first` adds 1. Total is 4. A duplicate save of the same title contributes zero additional points. `Mapping guide` does not contain token `map`.

```figure
pj-bookmark-path-organizer-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py bookmark-path-organizer --init my-bookmark-path-organizer
python3 scripts/project_test.py bookmark-path-organizer --stage 3 --path my-bookmark-path-organizer --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Test a keyword in notes only and a word embedded inside another word. Preserve unmatched records at score zero.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-bookmark-path-organizer
node cli.ts sample.json output
```

A standalone reading-path page and bookmarks.json with retained original URLs. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Support user-specified prerequisite edges before ranking independent topics.

Scope: The importer consumes the documented JSON folder tree, not arbitrary browser HTML. URL equality is document-oriented because fragments are removed; query strings remain significant. Ranking uses lexical tokens, not a remote model. Links are never fetched.
