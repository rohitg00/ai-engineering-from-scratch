# The audit

The audit reads every document, figure, listing, and quote of a manual, and prints one line per finding. It ends with `TOTAL <n>` and a count per rule. A manual does not merge until it prints `TOTAL 0`. Fix the text, the figure, or the capture. Never raise a limit to pass.

## Inside the AI Engineering from Scratch repo

Run these from the repository root, in this order:

```bash
node --test site/test_manuals.js
node site/build-manuals.js
node manuals/_shared/figkit.js build manuals/<id>
node scripts/audit_manuals.js --manual <id>
node site/build-manuals.js --print dist/manuals
npx --yes pagedjs-cli@0.4.3 dist/manuals/<id>/print.html -o dist/manuals/aiefs-manual-<id>.pdf
```

- `build-manuals.js` validates `manual.json` against the schema, parses every section, and writes `site/manual-<id>.html`, `site/manuals.html`, and `site/manuals-data.js`. Never commit those three files.
- Add `--drafts` to list draft manuals when you preview locally.
- Add `--skip-capture` to the audit to skip the capture check while you write prose.
- CI builds the PDF and attaches it to each release as `aiefs-manual-<id>.pdf`.

## Rules

Each finding names its rule. Reproduce these checks in your own script when you work outside the repo.

| Rule | Fails when |
|---|---|
| `dash` | prose holds an em dash or an en dash |
| `semicolon` | prose holds a semicolon |
| `may` | prose holds the word `may` |
| `contraction` | prose holds a contraction |
| `lexicon` | prose holds a banned word from [prose-rules.md](prose-rules.md) |
| `tell` | a sentence has an intensifier, inflation, a `not X but Y` shape, or a staged run-up |
| `long-sentence` | a sentence has more than 25 words |
| `long-step` | a takeaway has more than 20 words |
| `thesis` | a document has no thesis, or the thesis is more than one sentence or 30 words |
| `figure-claim` | a claim is more than one sentence or 28 words, or does not end with a period |
| `long-paragraph` | a paragraph has more than 6 sentences |
| `outcome` | the first two paragraphs of a section lack "When you finish this section, you can" |
| `takeaways` | a section has zero or more than one takeaways block |
| `sources` | the last block is not a paragraph that starts with `Sources: ` |
| `listing-fence` | a `json`, `jsonl`, `http`, or `sse` fence is not a `listing` |
| `provenance` | a listing line, or a piece of it around `…`, is not in its source file |
| `quote-key` | a quote cites a key that `quoteSources` does not declare |
| `quote` | a quote of 24 or more characters is not found word for word in its vendored file |
| `figure-orphan` | an SVG in `figures/` is not used by any document or the plate |
| `figure-drift` | a committed SVG differs from what its source script builds |
| `capture-drift` | `capture.check` exits with a non-zero status or passes its time limit |

The figure lint adds its own rules for legibility and SVG structure. The sibling `blueprint-figure` skill lists them.

## How the checks read the text

- Before the prose checks, remove inline code, citations, and quoted text. Keep link text and drop the link target.
- Split sentences at `.`, `!`, or `?` when a space and a capital letter, digit, quote, parenthesis, or `§` follow.
- Do not split after `e.g.`, `i.e.`, `vs.`, `etc.`, or `Fig.`.
- Before the quote check, drop link targets, `*`, and backticks, change curly quotes to straight quotes, and collapse white space. Do the same to the vendored file.

## Build checks

The build fails before the audit runs when:

- `manual.json` does not match the schema, or a section file is missing.
- A document uses raw HTML, a horizontal rule, a nested list, a `####` heading, or an extra quote block.
- A code fence has no language tag.
- A `figure` fence lacks a key, uses an unknown kind, or names a figure that does not exist.
- A `listing` or `rule` fence has no `---` line, or has no body.
- A `takeaways` block has fewer than two items.
- A `parts`, `palette`, `figure-index`, or `contents` block has a body.
- A `rule` block cites a key that `quoteSources` does not declare, or a declared vendored file is missing.

## Status

- A `draft` manual builds at `/manual-<id>.html` with `noindex`, and the index does not list it.
- A `ready` manual is listed on the index, needs a `README.md`, and adds a PDF to each release.
