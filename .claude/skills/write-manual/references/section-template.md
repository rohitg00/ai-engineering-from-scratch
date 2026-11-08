# Section template

Copy this skeleton into `sections/<n>-<m>-<slug>.md`. Replace every value. Keep the order of the blocks.

`````text
# CancelJob and terminal states

> Three terminal states end a job, the server chooses two of them, and CancelJob asks for the third.

Your client starts a long job and the user closes the window. The job keeps running and keeps spending money.

When you finish this section, you can tell the three endings apart, call `CancelJob`, and predict what a finished job answers.

## Terminal states

**Terminal state:** one of the three states that end a job: `DONE`, `FAILED`, and `CANCELED`.

```rule
label: the terminal rule
source: spec §3.4
---
"Once a job reaches a terminal state, it cannot restart."
```

```figure
id: fig-job-endings
kind: comparison
title: three ways a job ends
claim: The server chose two of these endings and the client chose one, and no call moves a job out of any of them.
caption: Each card is one job from the kit. Read the owner of the ending, then the final status. From capture/out/04-cancel.http.
```

```listing
title: the job after the cancel
source: capture/out/04-cancel.http
lang: json
note: Cut to the id and the state.
---
{
  "id": "job-0003",
  …
  "state": "CANCELED"
}
```

A second cancel gets an error, as §3.4 says for a job that is "already in a terminal state" {{spec §3.4}}.

```takeaways
- Stop every poll loop on all three terminal states.
- After a cancel that errors, read the job and act on its state.
```

Sources: spec §3.4 (research/sources/spec.md); capture/out/04-cancel.http
`````

## Rules for each block

| Block | Rule |
|---|---|
| title | the first line, one `#`, the name the specification uses |
| thesis | one `>` line directly under the title, one sentence, at most 30 words |
| opening | a concrete situation, then "When you finish this section, you can ..." within the first two paragraphs |
| definition | a paragraph that starts with `**Term:**`, written once, then added to the glossary |
| `rule` | `label` and `source`, a `---` line, then the quote. The first word of `source` is a citation key. |
| `figure` | `id`, `kind`, `title`, `claim`, `caption`. The id is lowercase and hyphenated, and an SVG with that id exists in `figures/`. |
| `listing` | `title`, `source`, `lang`, optional `note`, a `---` line, then lines copied from the source file |
| `takeaways` | exactly one block, two or more `- ` items, each an instruction of at most 20 words |
| sources line | the last paragraph, starts with `Sources: `, names every file and section the text uses |

## Listing cuts

Each listing line, after trimming, must appear in the source file. When a line holds `…`, each piece of 3 or more characters on either side must appear in the source. A line that is only `…` marks a cut of whole lines. Say in the `note` what the cut removed.

## Citations

A citation is `{{key reference}}`, such as `{{spec §3.1.5}}`, `{{proto TaskState}}`, or `{{sdk src/server/handler.py}}`. The first word is the key, and `quoteSources` must declare it. A quote of 24 or more characters followed by a citation is checked word for word against the vendored file for that key.

## Cross-references

Link a section as `[CancelJob](#s-4-4)`. Link a figure as `[figure](#fig-job-endings)`. Print editions add the page number. Link a lesson or file in the repository by its path, such as `[the lesson](phases/13-tools-and-protocols/19-a2a-protocol)`.

## Reference sections

A reference section has a title, a thesis, and a `Sources:` line. It has no outcome sentence and no takeaways. The reference part holds method tables, objects and fields, states, errors, and a glossary. It ends with the sources, the conflict register, and an empty `figure-index` block.
