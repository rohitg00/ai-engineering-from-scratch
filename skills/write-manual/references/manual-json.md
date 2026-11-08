# manual.json

`manual.json` is the manifest of one manual. It holds the identity, the pin, the palette, the ranked sources, and the order of parts and sections. The build validates it against a JSON Schema (draft 2020-12) and rejects any field that the schema does not define.

## Directory layout

```text
manuals/<id>/
  manual.json                 metadata, pin, palette, part and section order
  README.md                   required before status "ready"
  front.md                    "How to read this manual"
  sections/<n>-<m>-<slug>.md  one file per section
  sections/r-<n>-<slug>.md    reference sections
  figures/<figure-id>.svg     the static figures every edition uses
  figures/src/<figure-id>.js  optional figure source for each figure
  capture/                    the capture kit, and its output in capture/out/
  research/                   the fact briefs and research notes
  research/sources/           vendored primary sources, with their license
```

The `<id>` is lowercase and hyphenated, such as `a2a-101`, and it equals the directory name.

## Fields

| Field | Required | Rule |
|---|---|---|
| `id` | yes | matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `title`, `subtitle`, `summary` | yes | the name, the one-line scope, and a one-paragraph pitch |
| `audience` | yes | who the reader is and what they already know |
| `edition` | yes | `YYYY.MM` |
| `status` | yes | `draft` builds the page but does not list it. `ready` lists it and adds the PDF to each release. |
| `pin` | yes | `subject`, `version`, `source` (an `https://` URL), `commit` (7 or more characters), `date`, `verified` (both `YYYY-MM-DD`) |
| `outcomes` | yes | at least 3 things the reader can do after the manual |
| `palette` | yes | at least 3 entries of `hue` and `meaning` |
| `sources` | yes | the ranked list, each with `name`, `path`, `usedFor` |
| `quoteSources` | no | citation key to a vendored file, or `null` for a key whose quotes cannot be checked |
| `capture` | no | `run` and `check` argv arrays, run from the manual directory, and optional `timeoutSeconds` (default 300) |
| `front` | no | the front matter file, such as `front.md` |
| `plate` | no | the cover figure: `figure`, `title`, `caption` |
| `parts` | yes | ordered parts: `number`, `title`, `thesis`, optional `summary`, `accent`, `sections` |
| `reference` | no | `title`, `thesis`, `summary`, `accent`, and `sections` |
| `related` | no | repository paths of lessons that go deeper |

Section ids are `<part>.<n>` in order, such as `3.2`. Reference ids are `R.<n>`. Each section entry is `{ "id": "3.2", "file": "sections/3-2-part.md" }`.

Citation keys match `^[a-z][a-z0-9-]*$`, such as `spec`, `proto`, `docs`, `sdk`, or `spec-main`.

## Hues

The ten hues are `grey`, `blue`, `teal`, `violet`, `green`, `amber`, `plum`, `olive`, `indigo`, and `rose`. Four of them have the same meaning in every manual:

| Hue | Fixed meaning |
|---|---|
| `rose` | failure: errors, crashes, aborts, lost work |
| `grey` | outside the subject: the host, the operator, out of scope |
| `amber` | lifecycle: tasks, phases, state machines |
| `teal` | durable state: storage and committed records |

Give `blue`, `violet`, `green`, `plum`, `olive`, and `indigo` one meaning each for your manual. A hue keeps that meaning in every figure of the manual.

## Starter file

Replace every value. Keep the field names and the shapes.

```json
{
  "id": "example-101",
  "title": "Example 101",
  "subtitle": "The Example protocol, from its purpose to each request and response",
  "summary": "How a client asks an Example server for work. Each request and response in this manual comes from a recorded run.",
  "audience": "You know HTTP and JSON. You have not read the Example specification.",
  "edition": "2026.10",
  "status": "draft",
  "pin": {
    "subject": "Example protocol",
    "version": "1.0.0",
    "source": "https://example.org/example-spec",
    "commit": "0000000",
    "date": "2026-01-01",
    "verified": "2026-01-02"
  },
  "outcomes": [
    "Read a discovery document and say what the server offers.",
    "Predict the state of a job at any point of a run.",
    "Name the errors a client must handle."
  ],
  "palette": [
    { "hue": "violet", "meaning": "the client and what it sends" },
    { "hue": "blue", "meaning": "the server and what it sends back" },
    { "hue": "amber", "meaning": "jobs, job states, and transitions" },
    { "hue": "teal", "meaning": "stored records" },
    { "hue": "rose", "meaning": "errors and failure" },
    { "hue": "grey", "meaning": "the operator, the host, and anything outside the protocol" }
  ],
  "sources": [
    { "name": "Schema", "path": "schema/example.proto at v1.0.0", "usedFor": "every object, field, and method; cited as proto" },
    { "name": "Specification", "path": "docs/spec.md at v1.0.0", "usedFor": "every rule, quoted exactly; cited as spec §N" },
    { "name": "Reference SDK", "path": "example-sdk v1.0.0", "usedFor": "behavior where the spec is silent; cited as sdk" },
    { "name": "Capture kit", "path": "manuals/example-101/capture/", "usedFor": "every request and response shown; cited by file" }
  ],
  "quoteSources": {
    "spec": "research/sources/spec.md",
    "proto": "research/sources/example.proto",
    "sdk": null
  },
  "capture": {
    "run": ["python3", "capture/run.py"],
    "check": ["python3", "capture/run.py", "--check"]
  },
  "front": "front.md",
  "parts": [
    {
      "number": 1,
      "title": "The Protocol on One Page",
      "thesis": "Example defines a data model and a set of operations, and leaves the server internals open.",
      "accent": "violet",
      "sections": [
        { "id": "1.1", "file": "sections/1-1-what-example-standardizes.md" },
        { "id": "1.2", "file": "sections/1-2-one-job-request-by-request.md" }
      ]
    }
  ],
  "reference": {
    "title": "Reference",
    "thesis": "Lookup tables for every name in the manual.",
    "accent": "grey",
    "sections": [
      { "id": "R.1", "file": "sections/r-1-sources.md" }
    ]
  },
  "related": []
}
```

Inside the AI Engineering from Scratch repo, the schema is `manuals/manual.schema.json`, and `manuals/a2a-101/manual.json` is a complete example.
