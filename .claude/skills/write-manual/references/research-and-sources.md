# Research, sources, and the conflict register

A manual makes no claim that you cannot trace to a ranked source. Do the research before you write the first section, and keep it in files beside the manual.

## 1. Pin the subject

Choose one released version. Record it in `pin`:

| Key | Example |
|---|---|
| `subject` | `A2A protocol` |
| `version` | `1.0.1` |
| `source` | the repository URL, starting with `https://` |
| `commit` | the tag commit, at least 7 characters |
| `date` | the release date, `YYYY-MM-DD` |
| `verified` | the date you last checked the facts, `YYYY-MM-DD` |

Read the main branch too, at a recorded commit. Quote it only for rules that the tag lacks. Give it its own citation key, such as `spec-main`. Label each such rule as unreleased.

## 2. Rank the sources

List the sources in authority order. A common order for a protocol:

| Rank | Source | What the manual takes from it |
|---|---|---|
| 1 | the schema or proto at the tag | every object, field, enum value, and method |
| 2 | the specification at the tag | every behavior rule, quoted word for word |
| 3 | the project's own documentation pages | the project's framing, flagged where a page is out of date |
| 4 | the reference SDK at a tag | what a real implementation does where the specification is silent |
| 5 | the capture kit | every request, response, and event the manual shows |

When two sources disagree, the higher one wins and the text says so. Put the same table in the front matter, with a "Cited as" column.

## 3. Vendor the quotable sources

- Copy a source into `research/sources/` only when its license allows it.
- Copy it unchanged, and keep its license file beside it.
- Add a `README.md` in `research/sources/` that names each file, its upstream path, and the commit.
- When you join several pages into one file, put a comment before each page that names its path.
- Update the vendored files only together with `pin`.

## 4. Write the fact brief

Read every vendored source in full. Write each fact you will use as one line in a brief under `research/`. End the line with a reference, such as `[spec §3.1.5, L285]`. A brief per source works well, such as `research/brief-spec.md` and `research/brief-docs.md`. The sections then cite the source, and the brief tells a reviewer where to look.

## 5. Quote and cite

- Quote rules word for word, inside straight or curly double quotes, followed by a citation: `"..." {{spec §3.1.5}}`.
- Declare every citation key in `quoteSources`. A key maps to a vendored file, or to `null`.
- A `null` key marks a source that you cannot vendor, such as an SDK. Paraphrase it and cite a file path. Never quote it.
- Cite other SDKs with their own keys and a tag, such as `{{sdk-go a2asrv/agentexec.go at v2.6.0}}`.
- Never name or cite another guide, course, or book. Cite specifications, source code, papers, and the subject's own documentation.

## 6. Keep a conflict register

A specification often disagrees with itself, its schema, its docs, or its reference SDK. Record each disagreement once, with an id, and point to it from every section it affects.

Give each conflict an id in the order you find it: `D1`, `D2`, and so on. Put the register in the sources reference section, as one table:

| ID | The sources say | The manual follows | Discussed in | Upstream |
|---|---|---|---|---|
| D1 | **Subscribe verb.** Proto `GET`. §5.3 and §11.3.2 `POST`. | The proto. Accept both. | links to each section | the status of the issue or pull request upstream |

In the column "The sources say", start with a bold topic of two to four words. Then state each side with its section number. In "The manual follows", name the side the manual uses. That is the higher-ranked source, unless you state a reason.

In a section, show the conflict in full:

1. Quote the first source with its citation.
2. Quote the source that disagrees, with its citation.
3. Say which one the manual follows and why.
4. Tell the reader what to do, such as "accept both" or "call GetTask after a cancel that errors".
5. Link the register entry, such as `[conflict D1](#s-ref-sources)`.

Before each edition, check every open conflict upstream again. Record in the last column whether it is open, partly fixed, fixed on the main branch but unreleased, or released. Give discrepancies found later their own series, such as `N1`, `N2`, so the old ids do not change.

## 7. Compare implementations

Where the specification is silent, read each official SDK at one tag and compare how they behave. Put the result in a table with one row per SDK and one column per binding or case. Cite each cell with the SDK key and file. When the capture kit makes a choice that differs from the reference SDK, list that choice in the kit README.

Inside the AI Engineering from Scratch repo, see `manuals/a2a-101/research/` for the briefs and `manuals/a2a-101/sections/r-6-sources.md` for a register of 40 conflicts.
