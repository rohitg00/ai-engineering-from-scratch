# Writing for the interview bank

The interview bank holds questions and scenarios for AI engineering interviews. Each item links to the lessons and the manual sections that teach the answer. Each number in an answer comes from a file in this repository.

The site shows each question on its own page. The answers are on the page, folded behind "Show answer", so that a learner can try first. A scenario page shows the evidence one listing at a time.

## Folder shape

```text
interviews/
  AUTHORING.md                      this contract
  README.md                         generated index of the cards
  topics.yaml                       23 cards in 6 groups
  roles.yaml                        role views of the cards
  questions/<card-id>/<id>.md       one question
  questions/<card-id>/README.md     generated index of one card
  scenarios/<id>/README.md          one scenario
  scenarios/<id>/evidence/<name>.txt
  scenarios/README.md               generated index of the scenarios
  loops/<role-id>.md                optional: the rounds of one interview loop
```

Do not edit or commit a generated README. CI makes them again on main after each merge, so a pull request that changes one only causes conflicts with the other open pull requests. The interview bank check fails a pull request that changes one.

## Cards and groups

`topics.yaml` has two lists. `groups` gives the order and the title of the 6 groups. `cards` gives the 23 cards.

```yaml
cards:
  - id: inference-serving
    title: Inference and serving systems
    group: models
    planned: 30
    summary: Batching, the KV cache, prefix caching, schedulers and how to measure a serving engine.
    lessons:
      - phases/17-infrastructure-and-production/06-sglang-radixattention
    manuals:
      - vllm-101
```

| Key | Rule |
|---|---|
| `id` | lower case words joined by hyphens, unique |
| `title` | the card name on the site |
| `group` | an id from `groups` |
| `planned` | the number of items that the first version of the card needs |
| `summary` | one or two sentences |
| `lessons` | the lessons that a question on this card can name, as `phases/NN-phase/MM-lesson` |
| `manuals` | the manual ids that a question on this card can name |

The card `scenarios` holds the scenarios. The card `coding` links to the practice tasks.

## Roles

`roles.yaml` gives each role a view of the cards. A role with `path` reuses a career route in `learning-paths/`: the role id must equal the `id` in that file, and the site takes the title from it. A role without `path`, such as `inference-engineer`, gives its own `title` and `summary`.

```yaml
- id: inference-engineer
  title: Inference Engineering
  summary: Serve open models fast and cheap.
  cards: [inference-serving, gpu-memory-quantization, scenarios]
```

## Questions

One file holds one question: `interviews/questions/<card-id>/<id>.md`. The file starts with front matter between two `---` lines.

```markdown
---
id: prefix-cache-order
title: Why the shared part of the prompt goes first
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, system-design]
tags: [prefix-cache, kv-cache, ttft]
minutes: 8
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [vllm-101#s-make-repeated-prompts-hit-the-prefix-cache]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---
```

| Key | Rule |
|---|---|
| `id` | equals the file name without `.md` |
| `title` | 60 characters or fewer |
| `card` | equals the folder name |
| `kind` | `concept`, `tradeoff`, `design`, `debug`, `code-reading`, `estimate` or `take-home` |
| `level` | 1 screen, 2 working, 3 senior, 4 staff |
| `roles` | 1 or more ids from `roles.yaml` |
| `rounds` | 1 or more of `screen`, `coding`, `take-home`, `system-design`, `design-review`, `debugging`, `ml-depth`, `ml-breadth`, `behavioral`, `customer` |
| `tags` | 1 to 6 lower case hyphenated words |
| `minutes` | 2 to 60 |
| `lessons` | `phases/NN-x/MM-y`. The lesson must exist, and the card must list it as a source |
| `manuals` | `<manual-id>#s-<slug>`. The section must exist, and the card must list the manual as a source |
| `practice` | practice task ids from `practice/`, or `[]` |
| `cheatsheet` | cheat sheet ids from `cheatsheets/`, or `[]` |
| `related` | other items as `<card-id>/<id>` or `scenarios/<id>`, or `[]` |
| `updated` | the date of the last change, as `YYYY-MM-DD` |

A question names at least one lesson or one manual section.

The `#s-<slug>` part of a manual section is the section file name without the number, for example `sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md` gives `#s-make-repeated-prompts-hit-the-prefix-cache`. A reference section `r-3-incident-index.md` gives `#s-ref-incident-index`.

### Body

Write these parts in this order:

1. The prompt: one or more paragraphs with no heading. Write it as the interviewer says it.
2. `## Short answer`: 2 to 4 sentences. This is what a strong candidate says in the first minute.
3. `## Full answer`: the reasoning, the numbers and the trade-offs. You can use `###` headings, lists, tables and code blocks here.
4. `## Follow-ups`: 3 to 5 items. Each item has this form, and each level is equal to or higher than the level before it. The last level is higher than the first.

   ```markdown
   - **Level 2:** What does the hit rate tell you? Expected: the share of prompt tokens that came from the cache.
   ```

5. `## Wrong answers`: 2 to 5 items. Each item quotes a wrong answer and then gives the reason that it is wrong.

   ```markdown
   - "Turn the cache off for a fair test." The cache is on in production, so the test must reset it, not remove it.
   ```

6. `## Taught in`: one sentence that links the lessons or the manual sections.

Do not add other `##` headings. Do not put a part of an answer in the prompt or in a follow-up question. The validator compares the prompt with the answers and fails when they share a span of 24 characters.

## Scenarios

One folder holds one scenario: `interviews/scenarios/<id>/README.md` and its evidence files in `evidence/`.

The front matter has the question keys, with these changes:

- `card` is `scenarios` and `kind` is `incident`.
- `system` gives the system under test, with the keys `version`, `model` and `hardware`.
- `source` lists the repository files that the scenario comes from. Each evidence file names one of them.

```yaml
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.log
```

The body has these `##` sections, in this order:

| Section | Rule |
|---|---|
| `Situation` | what the candidate sees first: the system, the change, the symptom |
| `Evidence` | a list of `- [what it shows](evidence/<name>.txt)`. Each file in `evidence/` appears once. The site shows the listings in this order, one at a time. Without JavaScript, the page shows all of them |
| `Questions` | 3 to 6 numbered questions for the candidate |
| `Walkthrough` | how a strong candidate reads the evidence, step by step |
| `Resolution` | the cause and the fix, with the measurement that proves the fix |
| `Wrong turns` | 2 to 5 items in the form of wrong answers: a quoted wrong step and the reason |
| `Generalize` | the rule that transfers to other systems |
| `Taught in` | one sentence that links the lessons or the manual sections |

### Evidence files

An evidence file has header lines, a line with `---`, and then the listing.

```text
title: the prefill lines of the run at a cap of 32
source: manuals/sglang-101/capture/gpu/out-gb10/server-default.log
lines: 341-342
lang: text
note: Two prefill batches that admit 29 requests with one new token each.
---
[2026-10-17 14:23:00] Prefill batch, #new-seq: 14, ...
```

| Header | Rule |
|---|---|
| `title` | what the listing shows |
| `source` | a repository path from the `source` list of the scenario |
| `lines` | optional: `N-M`. The text after the `---` line must equal lines N to M of the source, byte for byte, with their line ends. Without `lines`, it must equal the whole source file |
| `lang` | `text`, `console`, `bash`, `json`, `jsonl`, `python` or `yaml` |
| `note` | one sentence that tells the reader where to look |

Do not change a copied line. Do not cut the end of a long line. If a line has a name from the denylist, pick other lines.

## Numbers

Every number of 10 or more, and every number with a decimal point, must come from a named source. This applies to the prompt and the answer parts of a question, and to every scenario section except `Evidence` and `Taught in`.

The named sources are:

- `docs/en.md` of each lesson in `lessons`;
- the section file of each manual section in `manuals`;
- for a scenario, also each file in `source` and the listing of each evidence file. The evidence header does not count as a source.

The validator reads each number as a token. It removes the commas in a number, so `1,213` and `1213` are the same. Do not round a number. Do not compute a new number in the text: copy the measured number, or say the ratio in words.

## Links and words

- Use relative repository links, for example `[the prefix cache section](../../../manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md)`. Each link must resolve. A link to a heading in a Markdown file must match a heading in that file.
- Do not use `http` links.
- Do not name a company. `scripts/interviews/denylist.txt` lists the names that the validator rejects. Name a model by its model id and a GPU by its model name.
- Write in Simplified Technical English: short sentences, one idea in each sentence, active voice, simple tenses.
- Do not use em dashes or en dashes.

## Loops

A loop file `loops/<role-id>.md` gives the rounds of one interview loop for one role. Its front matter has `role`, `title`, `minutes` and `updated`. The body is a list. Each item names one round from the `rounds` list and its minutes, and ends with the card id in the form `(card: <card-id>)`. A link to the card README is optional, because a card has a README only when it has items. The interview-prep skill uses the loops. The site does not show them yet.

## Validate

```bash
node scripts/interviews/validate.js
```

This command checks the bank, as CI does. To preview the generated READMEs, run it with `--write`. Before you commit, restore them with `git checkout -- interviews/README.md interviews/scenarios/README.md 'interviews/questions/*/README.md'`. The validator checks:

- the front matter keys and values, and the order of the body sections;
- the shape of the follow-ups and the wrong answers;
- that each lesson, manual section, practice task, cheat sheet and related item exists, and that the card lists each lesson and manual;
- that each link and each heading anchor resolves;
- the number rule;
- the denylist, and that no file has an em dash or an en dash;
- that each evidence listing matches its source;
- that the prompt does not show a span of an answer;
- with `--check-readmes`, that each generated README is current. The main-only CI job uses this.

## Site check rules

`node site/build-interviews.js --check` reads the bank as the site shows it. It fails on these rules:

1. The title and the prompt of a question go into the search index. They must not share a 24-character span with any answer in the bank, on any card.
2. The "Taught in" lines are visible text, so the same rule applies to them. Write the lesson name as the link text, in the form "the lesson" then a link such as `[advanced RAG](...)`, and do not copy words from the answer.
3. The Short answer and the prompt start with plain words, not with a code span. The search index drops some characters from code, so a code span at the start breaks the match between the record and the prompt.
4. Do not commit the generated READMEs. The validator and the site check do not need them current, and CI makes them on main after each merge.
