# Manual authoring contract

A manual explains one subject at one exact version, from its purpose to each request and response. A lesson teaches a concept and moves on. A manual stays with one system until a reader can predict what it will do in a case the manual never showed.

A 101 manual runs 60 to 100 pages: 6 to 8 parts, about 25 sections, 30 to 40 figures. Every record it shows came from a run. Every claim it makes traces to a ranked source. A claim that cannot be traced is cut.

The tooling enforces most of this contract. `node scripts/audit_manuals.js` must report `TOTAL 0` before a manual merges.

## What a manual is

- **One subject, one version, one date.** The title page pins the version, the source commit, the release date, and the date the facts were last verified.
- **Built from real runs.** A capture kit drives the subject offline and writes what it sees. Listings and figures are cut from those files, never typed from memory.
- **Traced to ranked sources.** The manual lists its sources in authority order. Each section ends with the files it was written from.
- **A companion to the lessons.** A manual links to phase lessons for depth. It never copies them.
- **Original.** Never name or cite another guide, course, or book as a source. Cite specifications, source code, papers, and the subject's own documentation.

## Files

```text
manuals/<id>/
  manual.json                 metadata, pin, palette, part and section order
  README.md                   required before status "ready"
  front.md                    "How to read this manual"
  sections/<n>-<m>-<slug>.md  one file per section
  sections/r-<n>-<slug>.md    reference sections
  figures/<figure-id>.svg     the static figures every edition uses
  figures/src/<figure-id>.js  optional figure kit source for each figure
  capture/                    the capture kit and its output in capture/out/
  research/brief.md           the fact brief the sections were written from
  research/sources/           vendored primary sources that the research checks against, with their license
```

The `<id>` is lowercase and hyphenated, such as `a2a-101`. It matches the directory name.

## manual.json

| Field | Meaning |
|---|---|
| `id`, `title`, `subtitle`, `summary` | identity and the one-paragraph pitch |
| `audience` | who the reader is and what they already know |
| `edition` | `YYYY.MM` of this edition |
| `status` | `draft` builds the page and does not list it. `ready` lists the page and adds the PDF to each release |
| `pin` | `subject`, `version`, `source` URL, `commit`, release `date`, `verified` date |
| `outcomes` | at least three things the reader can do after the manual |
| `palette` | the colour table: each `hue` and the one `meaning` it has in this manual |
| `sources` | the ranked source list: `name`, `path`, `usedFor` |
| `quoteSources` | map from a source key such as `spec` to a vendored file; `null` declares a key with no vendored file. Every source marker must use a declared key |
| `capture` | `run` and `check` argv arrays, run from the manual directory, and an optional `timeoutSeconds` for the check (default 300) |
| `front` | the front matter file |
| `plate` | the cover figure: `figure`, `title`, `caption` |
| `parts` | ordered parts: `number`, `title`, `thesis`, `summary`, `accent`, `sections` |
| `reference` | the reference part: `title`, `thesis`, `accent`, `sections` |
| `related` | repository paths of lessons that go deeper |

[manual.schema.json](manual.schema.json) is the machine-readable form, and the build validates every manifest against it. Section ids are `<part>.<n>` in order, such as `3.2`, and reference ids are `R.<n>`.

## The shape of a manual

**Front matter.** One document, `front.md`, titled "How to read this manual". It covers, in order: who the manual is for and what they can do after it, how it was made (the ranked sources table), the capture kit, the conventions, a first run the reader can do offline, how the parts are ordered (a `parts` block), colour in figures (a `palette` block), and figure 0.1, which teaches the arrow and colour grammar this manual uses. A user-first manual can open with a quickstart instead, and move how it was made, the capture kit, and the conventions to a reference section titled "How this manual was made" that the front matter links to. SGLang 101 uses this form.

**Part 1, the subject on one page.** Two sections, read once and completely:

1. what the subject standardizes, and what it leaves to each implementation;
2. one complete exchange from a capture, from the first request to the last response.

**Middle parts.** One part for each layer of the subject, such as its discovery document, its data model, its operations, its bindings, and its security and extension rules. Each section title names one thing that the reader can find in the specification: an object, an operation, a binding, a header, an error, or an extension. Do not write a section about a general idea, such as state machines or threats. Put the idea in the section about the object or the operation that has it.

**Last part, implementation.** Build a client and a server with the subject. Then show how to test both with the official conformance tools, and how to move from the previous version.

**Reference.** API or method tables, objects and fields, states, errors, a glossary, the sources, and the index of figures (a `figure-index` block).

## The shape of a section

1. `# Title`. Name the part of the subject that the section explains, with the name that the specification uses, such as "CancelTask and terminal states".
2. `> Thesis`. One sentence of at most 30 words: the claim the section proves.
3. An opening paragraph that starts from a concrete situation, then says "When you finish this section, you can ...". The outcome sentence must be in the first two paragraphs.
4. The body: `##` subsections, definition paragraphs that start with `**Term:**`, figures, listings, and tables.
5. Exactly one `takeaways` block. It says what to do with the section, as actions.
6. A final `Sources: ...` paragraph that names every file the section was written from. The audit reads it. The reader view does not render it.

Reference sections and the front matter need a thesis and a sources line, but no outcome sentence or takeaways.

## The markdown subset

The renderer accepts a small subset so that every edition renders the same way.

| Construct | Syntax |
|---|---|
| title | `# Title`, first line only |
| thesis | `> one sentence`, directly under the title |
| headings | `##` and `###`, with an optional `{#anchor}` |
| paragraphs, lists | plain paragraphs, `-` or `1.` lists, one level only |
| tables | pipe tables with a header row |
| emphasis | `**bold**`, `*italic*`, inline code |
| citation | `{{spec §4.1}}` stays in the source for verification and renders nothing |
| cross-reference | `[the effect](#s-5-3)` or `[figure](#fig-5-3)`; print adds the page number |
| repository link | `[the lesson](phases/13-tools-and-protocols/19-a2a-protocol)` |
| code | fenced blocks with a language tag |

Raw HTML, horizontal rules, nested lists, headings below `###`, and quote blocks other than the thesis fail the build. Section anchors are `s-<id>` with dots as hyphens, such as `s-1-4` and `s-r-2`.

## Fenced blocks

A figure:

````text
```figure
id: fig-4-1
kind: state
title: the task lifecycle
claim: A task ends in one of four terminal states and never leaves one.
caption: Read left to right. Dashed borders are interrupted states. From capture/out/task-states.txt.
```
````

A listing, cut from a capture file. Lines must appear in the source verbatim. Mark a cut with `…` on its own line or inside a line, and say what was cut in the note:

````text
```listing
title: the task after the second message
source: capture/out/07-book-turn-2.http
lang: json
note: The history array is cut after the first message.
---
{
  "id": "task-0003",
  …
}
```
````

A rule from a source, stated in our own words. The `source` key must be declared in `quoteSources`:

````text
```rule
label: the core rule
source: spec §3.1
---
The server must reply with a task.
```
````

Takeaways, two or more actions:

````text
```takeaways
- Read the card before you send a message.
- Treat every remote agent as opaque.
```
````

Generated blocks take no body: `parts`, `palette`, `figure-index`, and `contents`.

A code block or a listing is highlighted at build time. The `lang` of a listing and the tag of a code block follow the convention in [CONTRIBUTING.md](../CONTRIBUTING.md#code-blocks): `bash` for commands, `console` for a session with `$ ` prompts, `text` for output and logs, and `ansi` for coloured logs. A `text` or `ansi` listing gets no Copy button. A `console` block copies its commands only.

## Figures

### Ten kinds

| Kind | Use it for |
|---|---|
| `sequence` | parties on lifelines, time running down, numbered exchanges |
| `structure` | the anatomy of one record, object, or schema |
| `flow` | stages that data passes through, with who writes and who reads |
| `comparison` | two answers to one question, side by side |
| `timeline` | tracks over a numbered axis such as commit sequence or time |
| `tree` | ownership, containment, or delegation |
| `state` | a state machine with its transitions |
| `decision` | where something fails and what each outcome means |
| `layers` | a stack of layers with the parts each one owns |
| `chart` | measured runs plotted on axes: sweeps, distributions, and the spread over repeated runs |

The templates in [_shared/templates](_shared/templates) show one of each, drawn with the figure kit. A `chart` uses [_shared/chart.js](_shared/chart.js) on top of the figure kit and reads its numbers from a summary file that the capture kit writes, so the figure and the data cannot drift apart.

### Colour

Each manual has one colour table in `manual.json`, and a hue means the same thing in every figure of that manual. Four meanings stay fixed across all manuals:

| Hue | Fixed meaning |
|---|---|
| `rose` | failure: errors, crashes, aborts, lost work |
| `grey` | outside the subject: the host, the operator, out of scope |
| `amber` | lifecycle: tasks, phases, state machines |
| `teal` | durable state: storage and committed records |

Assign the other six hues (`blue`, `violet`, `green`, `plum`, `olive`, `indigo`) per manual.

### Arrows

Every manual draws exchanges with the same eight styles. Figure 0.1 of each manual teaches the ones it uses.

| Style | Means |
|---|---|
| solid ink | a call or request |
| dashed ink | a reply |
| solid teal | a durable write |
| dashed amber | a state change |
| solid plum | a model call or compute |
| dashed olive | an effect outside the system |
| dotted indigo | a stream or an event |
| dashed rose | a failure |

### What a figure must show

- The real system with real names: actual ids, field names, method names, and sequence numbers from a capture. Never generic boxes such as "Component A", stat cards, or progress bars.
- One claim. The caption starts with that claim in bold, one sentence of at most 28 words, then says how to read the figure, then names its source.
- Never a before and after against an earlier build. Compare two behaviours of the subject instead.

### Legibility

- Text is at least 11 units at the 640-unit width, which is 11 pixels on screen and about 8 points in print.
- No ellipsis in labels, no text over text, no text on a hatched fill, and no line through text.
- A label that does not fit goes outside with a leader line or into a numbered key. Never shrink it.
- Arrow labels sit on a small patch in the panel colour, marked `class="m-knock"`, so a line behind them stays hidden. The lint accepts only that patch, or an opaque box drawn after the line, as a mask. A patch never counts as the box a label must fit inside.
- The audit measures every label and fails on any of these.

### Technical rules

- `viewBox="0 0 640 H"` with H at most 760, `role="img"`, and `aria-labelledby="<id>-title <id>-desc"` on the root.
- A `<title>` and a `<desc>` of at least 40 characters as direct children.
- Every `id` starts with the figure id, because all figures share one page.
- Colours only as `var(--m-<token>, #hex)`, where the hex is the token's light value from [_shared/tokens.css](_shared/tokens.css).
- Only the elements and attributes the figure kit emits are allowed. No `style`, no scripts, no event handlers, no links, no images. At most 40 KB.
- Transforms only as `translate()` on `<g>`. One `<text>` per line.

### The figure kit

[_shared/figkit.js](_shared/figkit.js) draws figures from short scripts with the grammar above built in. It measures every label with the same metrics as the audit and throws when a label does not fit its box.

```javascript
const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-2', {
  height: 220,
  title: 'One delegated request',
  desc: 'A client agent sends one message to a remote agent, which answers with a task that the client follows to completion.',
}, f => {
  const client = f.box({ x: 20, y: 30, w: 180, h: 44, hue: 'violet', title: 'client agent', sub: 'planner' });
  const remote = f.box({ x: 440, y: 30, w: 180, h: 44, hue: 'blue', title: 'remote agent', sub: 'travel-agent' });
  f.arrow(client.right(), [remote.x - 1, client.cy], { style: 'call', label: 'SendMessage', note: 'one JSON-RPC request' });
});
```

Save it as `figures/src/fig-1-2.js` and run `node manuals/_shared/figkit.js build manuals/<id>`. The audit fails when a committed SVG differs from its source. A figure without a source file is checked as a hand-written SVG.

## Listings and the capture kit

- A JSON, HTTP, SSE, or JSONL block must be a `listing` with a `source`. The audit fails a `json` fence that is not a listing.
- The capture kit lives in `capture/`. It runs offline, needs no network and no keys, and follows the repository dependency allowlist.
- A subject that is a proprietary binary or a hosted service cannot run offline in CI. Its kit records on the author's machine with the pinned binaries installed. Its `check` compares stored outputs after masking, and when the subject is not installed it prints `skipped` with the reason and exits 0. The front matter names the captures recorded that way and the machine they were recorded on.
- `capture.run` writes `capture/out/`. `capture.check` writes to a temporary directory and compares with `capture/out/` after masking values that change on every run, such as timestamps and generated ids. The audit runs `capture.check` and fails on drift.
- A listing names its source file in the `source:` field, so the build and the audit can check the excerpt. The reader view shows the title and the language, not the file path.

## Sources and quotes

- `sources` in `manual.json` is ranked by authority. When two sources disagree, the higher one wins and the text says so.
- Vendor a source under `research/sources/` only when its license allows it, and keep its license file beside it.
- The manuals present our own research, so we write every claim in our own words. Do not quote prose from a spec, docs, an issue, a post, or a code comment. Keep the force of a MUST, SHOULD, or MAY with "must", "should", or "is allowed to".
- Quote marks are for literal strings only: log lines, error messages, CLI output, field values, and titles of reports. Put literal output in code font where you can.
- Name another team only where you show their research or results, once, in plain prose, such as "SemiAnalysis measured ...".
- Every source marker such as `{{spec §4.1}}` and every `rule` block must use a key declared in `quoteSources`. The build fails on an undeclared rule key or a missing file, and the audit flags an undeclared marker key.
- The audit flags quoted prose of 24 or more characters next to a source marker, and a `rule` block that starts with a quote mark.
- Citations, `Sources:` lines, and listing source paths live in the markdown for verification. They never render in a section. A reader sees no file paths, capture file names, commits, or citation chips in the prose.
- Evidence is linked, never printed. A listing with a `source:` gets a "Full log" link to that file on GitHub. A paragraph that starts with **We measured** gets one "Raw runs" link: the summary file of the machine that the paragraph or its heading names, or the capture folder, when the section's `Sources:` line lists it. A section with no evidence path in its `Sources:` line gets no link. A ` ```lab-runs``` ` block renders one row for each sweep in `capture/gpu/summary/`. The build fails when a linked path does not exist.
- A figure caption can end with a sentence that starts with "From" and names its sources. The reader view drops that sentence.
- The sources reference page is the one place a reader sees where the facts came from. Write it for people: the kinds of sources, such as the code and docs, our measured runs, issues and pull requests, and papers, and the external reports by title and date. Do not list repository file paths there.

## Prose

Write to one reader, in the second person, about the mechanism. Start from a situation the reader has been in. Keep paragraphs short. Define a term once, use it the same way everywhere, and add it to the glossary.

The audit enforces these limits from Simplified Technical English:

- at most 25 words in a sentence, 30 in a thesis, 28 in a figure claim;
- no semicolons, no contractions, no em or en dashes;
- no "may" as a verb: say "can", or state the condition;
- at most 20 words in each takeaway, which is an instruction, and at most six sentences in a paragraph;
- no figurative or slang words: write "the HTTP request" or "the stream", never "the wire";
- no technical noun used as a verb, such as "gate", "ship", or "surface";
- no stock AI vocabulary, such as "robust", "seamless", "crucial", or "leverage";
- no filler intensifiers or "not X but Y" constructions.

The word list is `LEXICON` in `scripts/audit_manuals.js`. Each entry names the plain word to use instead.

Code, literal strings, and source markers are exempt.

## Build and check

```bash
node --test site/test_manuals.js
node site/build-manuals.js
node scripts/audit_manuals.js --manual <id>
node site/build-manuals.js --print dist/manuals
npx --yes pagedjs-cli@0.4.3 dist/manuals/<id>/print.html -o dist/manuals/aiefs-manual-<id>.pdf
```

`site/build-manuals.js` writes `site/manual-<id>.html`, the index `site/manuals.html`, and `site/manuals-data.js`. All three are generated on deploy and never committed. The index lists `ready` manuals only. Add `--drafts` to list drafts too when you preview locally. The PDF is built in CI and attached to each release as `aiefs-manual-<id>.pdf`. To attach the PDFs to an existing release again, start the Manuals workflow by hand and give the release tag.

## Status and commits

- A `draft` manual builds at `/manual-<id>.html` with `noindex` and is not listed.
- A `ready` manual is listed on the manuals page, needs a `README.md`, and adds a PDF to each release.
- Size commits by judgment. A section with its figures and the captures it adds is a good unit: `feat(manual/<id>): <section slug>`. A small fix across sections can be one commit.
