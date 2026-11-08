---
name: write-manual
version: 1.0.0
description: >
  Writes a long technical manual that explains one subject at one pinned version, from its purpose to each request and response.
  Every listing comes from an offline capture, every claim traces to a ranked source, and an audit must report TOTAL 0.
  Use it for "write a manual", "write a 101 manual for <subject>", "manual.json", "add a manual section",
  "build a capture kit", "audit the manual", or "pin a spec version and document it".
tags: [manuals, documentation, specifications, technical-writing, audit]
---

# Write a manual

A manual explains one subject, such as a protocol, a file format, or a runtime, at one exact version. A lesson teaches a concept and moves on. A manual stays with one system until the reader can predict what it does in a case the manual never showed.

This skill gives the full method. It covers research, ranked sources, and a register of conflicts between sources. It also covers an offline capture kit, a fixed section shape, prose limits, and an audit that must report `TOTAL 0`. It works in any repository. Inside the AI Engineering from Scratch repo, the tooling already exists, and `manuals/a2a-101/` is the worked example.

## When to use

- The reader must predict the behavior of one system, at one version, in cases you did not show.
- The subject has a specification, a schema, or a source tree that you can pin to a commit.
- You can run the subject, or a faithful stand-in, offline and record its requests and responses.
- The result is 60 to 100 pages with figures, and other people will maintain it.

## When not to use

- You teach a general concept, such as attention or retrieval. Write a lesson instead.
- The subject has no version to pin, or changes every week.
- You cannot run the subject and cannot record its output. A manual without captures is an essay.
- You want a short how-to. A manual of fewer than about 15 sections does not need this shape.

## Size of a 101 manual

| Item | Target |
|---|---|
| pages | 60 to 100 |
| parts | 6 to 8, plus one reference part |
| sections | about 25 |
| figures | 30 to 40 |
| outcomes in `manual.json` | at least 3 |
| takeaways per section | exactly 1 block, with at least 2 items |

The worked example has 7 parts, 28 sections, 7 reference sections, and 31 figures.

## Method

1. **Pin the subject.** Record the version, source URL, commit, release date, and verified date.
2. **Rank the sources.** List them in authority order: schema or proto, specification, project docs, reference SDK, capture kit.
3. **Vendor what the license allows.** Copy each quotable source unchanged into `research/sources/`, with its license file beside it.
4. **Write the fact brief.** Index every rule you will use by section and line number, in `research/`. See [references/research-and-sources.md](references/research-and-sources.md).
5. **Open the conflict register.** Give each disagreement between two sources an id (`D1`, `D2`, ...) as you find it.
6. **Build the capture kit.** Drive the subject offline and write deterministic files to `capture/out/`. See [references/capture-kit.md](references/capture-kit.md).
7. **Plan the contents from the specification.** Name each section after one thing the reader can find in the spec.
8. **Write `manual.json`.** Fill the pin, outcomes, palette, ranked sources, quote sources, capture commands, and parts. See [references/manual-json.md](references/manual-json.md).
9. **Write the front matter.** Title it "How to read this manual" and follow the order in "Front matter" below.
10. **Write one section at a time.** Use the section shape below. Cut every listing from a capture file.
11. **Draw each figure from a capture.** Follow the figure must-haves below and the sibling `blueprint-figure` skill.
12. **Build and audit.** Fix every finding until the audit prints `TOTAL 0`. See [references/audit.md](references/audit.md).
13. **Size commits by judgment.** A section with its figures and the captures it adds is a good unit.

## Plan the contents from the specification

Build the table of contents from the names the specification uses, then decide what each part proves.

- **Front matter.** One document, `front.md`, titled "How to read this manual".
- **Part 1, the subject on one page.** Two sections: what the subject standardizes, then one complete exchange from a capture.
- **Middle parts.** One part per layer of the subject, such as discovery, data model, operations, bindings, security, and extensions.
- **Last part, implementation.** Build a client and a server. Test both with the official conformance tools. Explain migration from the previous version.
- **Reference part.** Method tables, objects, states, errors, a glossary, the sources and conflicts, and the figure index.

Each section title names one object, operation, binding, header, error, or extension from the specification. "CancelTask and terminal states" is a good title. "State machines" is not, because no specification defines an object with that name. Put a general idea in the section about the object that has it.

## Front matter

`front.md` covers these topics, in this order:

1. Who the manual is for, and what they can do after it.
2. How it was made, with the ranked sources table.
3. The capture kit.
4. The conventions: citation forms, listing cuts, and id shortening.
5. A first run that the reader can do offline.
6. How the parts are ordered, as an empty `parts` block.
7. Colour in figures, as an empty `palette` block.
8. Figure 0.1, which teaches the arrow and colour grammar of this manual.

## Section shape

Every section file follows this order. Reference sections and the front matter need a thesis and a sources line, but no outcome sentence and no takeaways.

1. `# Title`, with the name the specification uses.
2. `> Thesis`, directly under the title: one sentence of at most 30 words, the claim the section proves.
3. An opening paragraph that starts from a concrete situation the reader has been in.
4. The sentence "When you finish this section, you can ..." inside the first two paragraphs.
5. The body: `##` subsections, definitions that start with `**Term:**`, figures, listings, rules, and tables.
6. Exactly one `takeaways` block, with two or more actions.
7. A last paragraph that starts with `Sources:` and names every file the section was written from.

A complete template is in [references/section-template.md](references/section-template.md).

## Fenced block kinds

| Fence | Holds | Required keys |
|---|---|---|
| `figure` | one figure, by id | `id`, `kind`, `title`, `claim`, `caption` |
| `listing` | lines cut from one capture file | `title`, `source`, `lang`, optional `note`, then `---` and the lines |
| `rule` | one quote, checked word for word | `label`, `source`, then `---` and the quote |
| `takeaways` | the actions for the section | two or more `- item` lines |
| `parts`, `palette`, `figure-index`, `contents` | generated tables | no body |

Every other fence needs a language tag. A `json`, `jsonl`, `http`, or `sse` fence must be a `listing` instead.

## Markdown subset

Use only these constructs, so every edition renders the same way:

- One `#` title on the first line, and the thesis quote under it.
- `##` and `###` headings, each with an optional `{#anchor}`.
- Paragraphs, and one-level `-` or `1.` lists.
- Pipe tables with a header row.
- Bold, italic, and inline code.
- `{{key ref}}` citations, `[text](#s-5-3)` cross-references, and repository links.

Raw HTML, horizontal rules, nested lists, `####` headings, and other quote blocks fail the build. Section anchors are `s-` plus the id with dots as hyphens, such as `s-1-4` or `s-r-2`.

## Listings

- Cut every listing from a file in `capture/out/`. Never type a request or a response from memory.
- Each listing line must appear in its source file exactly as written.
- Mark a cut with `…` on its own line or inside a line.
- Say what you cut in the `note`.
- Name the source file in `source`, so the reader can open the full record.

## Sources, quotes, and conflicts

- Rank `sources` by authority. When two sources disagree, the higher one wins and the text says so.
- Quote a rule word for word, then cite its key: `"quoted text" {{spec §3.1.5}}`.
- Declare every citation key in `quoteSources`. Map it to a vendored file, or to `null` when the source cannot be vendored.
- Paraphrase sources with a `null` key, such as an SDK. Never quote them.
- When sources disagree, quote both sides in the section, say which one the manual follows, and link the register entry.
- Keep the register in the sources reference section. Give it five columns: id, sources, choice, sections, and upstream status.
- Never name or cite another guide, course, or book. Cite specifications, source code, papers, and the subject's own documentation.

## Prose limits

| Limit | Value |
|---|---|
| words in a sentence | at most 25 |
| words in a thesis | at most 30, one sentence |
| words in a figure claim | at most 28, one sentence ending with a period |
| words in a takeaway | at most 20, an instruction in imperative mood |
| sentences in a paragraph | at most 6 |

Write in the second person, about the mechanism. Define a term once, use it the same way everywhere, and add it to the glossary. Quotes, code, and citations are exempt from the limits.

Use no semicolons, no contractions, and no em or en dashes. Never write the word `may`. Use "can", or state the condition. Avoid the banned words in [references/prose-rules.md](references/prose-rules.md).

## Figure must-haves

Use the sibling `blueprint-figure` skill to draw the figures. Every figure in a manual must also meet these rules:

- Use one of nine kinds: `sequence`, `structure`, `flow`, `comparison`, `timeline`, `tree`, `state`, `decision`, `layers`.
- Show the real system: real ids, field names, method names, and sequence numbers from a capture.
- Make one claim of at most 28 words. The caption says how to read the figure, then names its capture file.
- Never draw generic boxes such as "Component A", stat cards, or progress bars.
- Compare two behaviors of the subject. Never compare against an earlier build.
- Give each hue one meaning per manual. `rose` is failure, `grey` is outside the subject, `amber` is lifecycle, `teal` is durable state.
- Draw exchanges with the eight arrow styles below. Figure 0.1 teaches the ones the manual uses.
- Use `viewBox="0 0 640 H"` with H at most 760, text at least 11 units, and a file of at most 40 KB.
- Put a `<title>` and a `<desc>` of at least 40 characters on the root, which has `role="img"`.
- Start every `id` in the SVG with the figure id, because all figures share one page.
- Write colours only as `var(--m-<token>, #hex)`, with the light value of the token as the hex.

| Arrow style | Means |
|---|---|
| solid ink | a call or request |
| dashed ink | a reply |
| solid teal | a durable write |
| dashed amber | a state change |
| solid plum | a model call or compute |
| dashed olive | an effect outside the system |
| dotted indigo | a stream or an event |
| dashed rose | a failure |

## Build and audit

Inside the AI Engineering from Scratch repo, run these from the repository root:

```bash
node --test site/test_manuals.js
node site/build-manuals.js
node manuals/_shared/figkit.js build manuals/<id>
node scripts/audit_manuals.js --manual <id>
```

Outside the repo, build your own audit from [references/audit.md](references/audit.md). It lists each check, so you can write it as one script. Fix the text, never the limit. A manual does not merge until the audit prints `TOTAL 0`.

## Commit rules

- Size commits by judgment. A section with its figures and the captures it adds is a good unit. A small fix across sections can be one commit.
- Use the message `feat(manual/<id>): <section slug>`.
- Never commit generated output. Inside the repo, that is `site/manual-<id>.html`, `site/manuals.html`, and `site/manuals-data.js`.
- Keep `status` at `draft` until the manual is complete. A `ready` manual needs a `README.md`.
- Update vendored sources only together with the `pin` in `manual.json`.

## Check before you finish

- [ ] `manual.json` validates, and `pin` has subject, version, source, commit, date, and verified.
- [ ] Every section title names one thing that the specification defines.
- [ ] Every section has a thesis, an outcome sentence in its first two paragraphs, one takeaways block, and a `Sources:` line.
- [ ] Every `json`, `jsonl`, `http`, and `sse` block is a `listing` with a capture source.
- [ ] The capture check runs offline and reports no drift.
- [ ] Every quote of 24 or more characters is found word for word in its vendored file.
- [ ] Every conflict has a register id, and each section that meets it links that id.
- [ ] Every figure SVG is used by a document and matches its source script.
- [ ] The audit prints `TOTAL 0`.
- [ ] Commits are sized by judgment, with messages such as `feat(manual/<id>): <section slug>`.

## Files

- [references/manual-json.md](references/manual-json.md): every field of `manual.json`, with a starter file.
- [references/section-template.md](references/section-template.md): a section skeleton with each fence kind.
- [references/research-and-sources.md](references/research-and-sources.md): the fact brief, vendoring, quotes, and the conflict register.
- [references/capture-kit.md](references/capture-kit.md): how to record deterministic captures and check them for drift.
- [references/prose-rules.md](references/prose-rules.md): the limits and the full banned word list.
- [references/audit.md](references/audit.md): every audit rule, and how to reproduce the audit outside the repo.
- Inside the AI Engineering from Scratch repo, also see `manuals/AUTHORING.md`, `manuals/manual.schema.json`, and `manuals/a2a-101/`.
