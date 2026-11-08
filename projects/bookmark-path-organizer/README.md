# Bookmark Path Organizer

Help a reader recover a useful collection from an exported bookmark pile. Normalize URLs conservatively, merge exact duplicates, score user-defined topics from saved titles and notes, and export an editable reading path as HTML and JSON.

You build a standalone reading-path page and bookmarks.json with retained original URLs.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/bookmark-path-organizer/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. Exports bookmarks.json, progress.json and report.html. Pass a downloaded progress file as the third argument to resume its edited order and completed checkboxes.

## Build it yourself

```bash
python3 scripts/project_test.py bookmark-path-organizer --init my-bookmark-path-organizer
python3 scripts/project_test.py bookmark-path-organizer --stage 1 --path my-bookmark-path-organizer --strict
python3 scripts/project_test.py bookmark-path-organizer --all --path my-bookmark-path-organizer --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Import bookmarks with their original hierarchy](stages/01-import-hierarchy/docs/en.md)
2. [Normalize links and explain duplicate groups](stages/02-explain-duplicates/docs/en.md)
3. [Rank topics and assemble a reading path](stages/03-rank-reading-path/docs/en.md)
4. [Export an editable collection and progress file](stages/04-export-progress/docs/en.md)

## Contracts and integration

- `importBookmarks(input: unknown): Bookmark[]`
- `normalizeURL(value: string): string; groupDuplicates(items: Bookmark[]): Group[]`
- `readingPath(groups: Group[], topics: Record<string,string[]>): Reading[]`
- `applyProgress(items: Reading[], value?: unknown): {items: Reading[]; progress: Progress}; renderCollection(items: Reading[], progress: Progress): string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py bookmark-path-organizer --all --solution --strict
```

The importer consumes the documented JSON folder tree, not arbitrary browser HTML. URL equality is document-oriented because fragments are removed; query strings remain significant. Ranking uses lexical tokens, not a remote model. Links are never fetched.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
