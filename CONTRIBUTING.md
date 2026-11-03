# Contributing

Lessons, manuals, cheat sheets, practice problems, projects, translations, fixes,
outputs: all welcome. One contribution per pull request keeps reviews fast and
lets contributor counts and credit work correctly.

[AGENTS.md](AGENTS.md) is the full operating manual for this repo, for people
and for AI agents. Read it before your first pull request. This page is the
short map: what you can add, where the deeper rules live, and which commands
to run before you push.

## Important: the README and ROADMAP feed the website

`site/build.js` parses `README.md`, `ROADMAP.md`, and `glossary/terms.md` to
generate `site/data.js`. These patterns must stay intact in any pull request
that touches those files:

- Phase headers in either `### Phase N: Name \`X lessons\`` form or the
  `<details><summary><b>Phase N ...</b> ... <code>X lessons</code> ... <em>Description</em></summary>`
  form. Copy an existing header line when you add one.
- Lesson tables with the column shape `| # | Lesson | Type | Lang |` (or
  `| # | Project | Combines | Lang |` for capstone tables). The `Lang` column
  accepts plain text (`Python, TypeScript`) or the legacy emoji flags
  (`🐍 🟦 🦀 🟣 ⚛️`); both are parser-equivalent.
- Lesson rows link to the lesson folder: `[Title](phases/NN-phase/MM-lesson/)`.
  The site takes the lesson URL from that link.
- ROADMAP status glyphs (`✅`, `🚧`, `⬚`) on phase headers and lesson rows.
  Do not replace them with text. The parser keys off the exact characters.

Run `node site/build.js` after editing those files. `git diff site/data.js`
should show only the timestamp change if your edit was structural-safe. Then
restore it with `git checkout -- site/data.js`: CI rebuilds it on every push
to main, so it never goes in a pull request.

## Code blocks

Every fenced code block needs a language tag. The tag sets how the site shows
the block and what its Copy button copies:

| Tag | Use it for | The page shows |
|---|---|---|
| `bash`, `python`, `json` and other languages | commands or code that the reader runs or pastes | highlighted code with a Copy button |
| `console` | a terminal session: each command starts with `$ `, and output lines have no prompt | the prompt, the command and the output in different colours. Copy copies the commands only |
| `text` | program output, logs and plain text | output with no Copy button |
| `ansi` | logs that keep their ANSI colour codes | coloured output with no Copy button |

Do not put a `$ ` prompt in a `bash` block. Use `console` for a session, or
remove the prompts. Practice pages, cheat sheets and manuals are highlighted at
build time by `site/lib/code.js`. Lessons are highlighted in the browser and
use the same block markup.

## Ways to contribute

### 1. Add a new lesson

Each lesson lives in `phases/NN-phase-name/MM-lesson-name/`:

| Path | What it holds |
|---|---|
| `docs/en.md` | Lesson documentation (required) |
| `code/` | `main.<lang>` for each language in the Languages field |
| `code/tests/` | 5 or more tests, run with the language's stdlib runner |
| `quiz.json` | 6 questions: 1 pre, 3 check, 2 post |
| `notebook/` | Jupyter notebook for experimentation (optional) |
| `outputs/` | Prompts, skills, or agents this lesson produces (if applicable) |

`scripts/scaffold-lesson.sh <phase-dir> <lesson-slug> "<Title>"` creates the
folders and a `docs/en.md` skeleton. [LESSON_TEMPLATE.md](LESSON_TEMPLATE.md)
has the section order (The Problem, The Concept, Build It, Use It, Ship It,
Exercises). The [Lesson contract](AGENTS.md#lesson-contract) in AGENTS.md has
the exact frontmatter (`**Type:**`, `**Languages:**`, `**Prerequisites:**`,
`**Time:**`), the `quiz.json` schema, and the rules for `code/`.

Then:

- Add the lesson row to `README.md` and its status row to `ROADMAP.md`.
- Add the lesson to a topic in `cheatsheets/topics.yaml`. The cheat sheet
  check fails when a lesson has no topic (see [Cheat sheets](#4-cheat-sheets)).
- Add a term to `glossary/terms.md` when more than one lesson uses it.

Quizzes: keep the distractors comparable in length to the correct option, and
spread the correct answers across positions. `python3 scripts/check_quiz_bias.py --check`
and `python3 scripts/debias_quizzes.py --check` gate both in CI.

Math: write formulas as LaTeX (`$...$` inline, `$$...$$` for a block) outside
code. `python3 scripts/find_plain_math.py --phase NN --list` reports plain-text
math that could be LaTeX. `node scripts/check_lesson_math.js --katex <path to katex.min.js> NN`
renders every formula in a phase with the KaTeX build pinned in
`site/lesson.html`, and `node --test site/test_lesson_math.js` runs in CI.

### 2. Figures for lessons

Diagrams are Mermaid or SVG only, never ASCII or box-drawing art. A lesson
embeds a registered figure with a `figure` fence:

````text
```figure
ctc-collapse
```
````

The figure ids are registered with `LF.register` in the `site/figures-*.js`
files. An isometric machine that follows the Build It steps is one entry in
`MACHINES` in `site/figures-iso.js`, embedded as:

````text
```figure
iso-machine {"machine":"self-attention"}
```
````

`node --test site/test_lesson_walkthrough.js` covers the step sync. The skills
in `skills/` describe the house look: `blueprint-figure` for static SVG,
`motion-figure` for animated and interactive figures, `isometric-explainer`
for full machine pages, and `course-style` for colour tokens and prose rules.

### 3. Write or extend a 101 manual

A manual under `manuals/<id>/` explains one subject at one pinned version.
[manuals/AUTHORING.md](manuals/AUTHORING.md) is the contract: manual and
section shape, the markdown subset, figure kinds and colours, the capture kit,
and the prose limits. The short version:

- Every listing is cut from a capture file. The capture kit runs offline with
  `python3 capture/run.py` and checks for drift with `python3 capture/run.py --check`,
  both from the manual directory, as declared in `manual.json`.
- Figures are drawn with the figure kit, `manuals/_shared/figkit.js`. Save the
  source as `figures/src/<figure-id>.js` and run
  `node manuals/_shared/figkit.js build manuals/<id>`. The audit fails when a
  committed SVG differs from its source.
- `status` in `manual.json` is `draft` or `ready`. A draft builds at
  `/manual-<id>.html` with `noindex` and is not listed. A ready manual is
  listed on the manuals page, gets a PDF on each release, and needs
  `manuals/<id>/README.md`.
- The build writes the manual page, one page per section under
  `/manual-<id>/`, the manuals index, and `site/manuals-data.js`. All of them
  are generated on deploy and never committed.

```bash
node --test site/test_manuals.js
node site/build-manuals.js --drafts
node scripts/audit_manuals.js --manual <id>    # must report TOTAL 0
```

The `write-manual` skill in `skills/` walks through the same contract.

### 4. Cheat sheets

A cheat sheet is one topic in `cheatsheets/<id>.md`, with an evidence file in
`cheatsheets/evidence/<id>.md` and an entry in `cheatsheets/topics.yaml`.
[cheatsheets/AUTHORING.md](cheatsheets/AUTHORING.md) has the block types, the
fact rules, and the quality rubric.

```bash
node --test site/test_cheatsheets.js site/test_cheatsheet_topics.js scripts/cheatsheets/test_generate.js
node site/build-cheatsheets.js --check            # coverage, facts, evidence, links, page count
node site/build-cheatsheets.js --check-quality    # quality rubric on every sheet
node site/build-cheatsheets.js --status           # missing and stale sheets
```

Most sheets are written by the generator. The `Cheat sheets generate` workflow
runs once a week, writes the missing and stale topics with
`scripts/cheatsheets/generate.js`, runs the gates, and opens a pull request for
review. It has cost guards: Haiku by default with one escalation to Sonnet,
Opus only on a manual run, at most 5 topics and 600,000 tokens per run in CI,
and no scheduled run while another cheat sheet pull request is open. To write
one sheet locally, set `ANTHROPIC_API_KEY`, install `@anthropic-ai/sdk`, and
run `node scripts/cheatsheets/generate.js <id>`. Pass `--limit` and
`--token-budget` to cap a local run.

### 5. Practice problems and projects

- A practice problem lives in `practice/<id>/`. Read
  [practice/AUTHORING.md](practice/AUTHORING.md), then run
  `python3 scripts/practice/validate.py <id> --write` and
  `python3 scripts/practice/validate.py`. The `Practice problems generate`
  workflow drafts problems from lesson paths on a manual run, with the same
  model choice and token budget inputs as the cheat sheet generator.
- A project lives in `projects/<id>/`. Read
  [projects/AUTHORING.md](projects/AUTHORING.md), then run
  `python3 scripts/project_test.py <id> --all --solution --strict` and
  `node site/build-projects.js --strict`. Unbuilt ideas go in
  `projects/roadmap.json` under `planned`.

### 6. Translations

English is canonical. Read [docs/i18n.md](docs/i18n.md) before you translate.

- **Lesson translations are never committed to `main`.** They live on the
  `translations` branch at `i18n/<lang>/phases/<phase>/<lesson>/docs/<lang>.md`.
  Do not add `zh.md` or other locale files next to `docs/en.md`.
- **Automatic languages** have `ci: true` in `languages.json`. The `translate`
  workflow (`.github/workflows/translate.yml`) translates their lessons with
  NLLB-200 inside the runner after each push to main that changes a
  `docs/en.md`. Do not hand-edit those files; fix the English instead.
- **Contributor-maintained languages** have `site: true`, such as `zh-TW`.
  Send reviewed lesson translations as a pull request against the
  `translations` branch. The workflow keeps them and does not overwrite them
  when the English changes.
- **The freshness table** in each translate run summary lists current, stale,
  missing, and orphaned lessons per language. For a contributor-maintained
  language, the stale rows are the translations to update after an English
  fix. Run it locally with
  `git fetch origin translations:refs/remotes/origin/translations && python3 scripts/translation_freshness.py`.
- **README translations** are full documents on `main` at
  `i18n/<lang>/README.md`. When you change the English README, update every
  locale and run `python3 scripts/build_readme_i18n.py --check` and
  `python3 scripts/test_audit_readme_locales.py`.
- **To propose a new language**, open a pull request that adds its entry to
  `languages.json` with its FLORES-200 `nllb` code, as
  [Add a language](docs/i18n.md#add-a-language) describes. A new README
  language must be a complete translation and joins `FULL_LOCALES` in
  `scripts/audit_readme_locales.py`. Open an issue first if you are unsure
  whether it should be automatic or contributor-maintained.

Certification lessons and manuals stay English-only.

### 7. Add an output

If a lesson should produce a reusable prompt, skill, agent, or MCP server:

1. Create it in the lesson's `outputs/` folder
2. Add a reference in the top-level `outputs/` index

**Prompt format:**

```markdown
---
name: prompt-name
description: What this prompt does
phase: 14
lesson: 01
---

[System prompt or template here]
```

**Skill format:**

```markdown
---
name: skill-name
description: What this skill teaches
version: 1.0.0
phase: 14
lesson: 01
tags: [agents, loops]
---

[Skill content here]
```

### 8. Site work

The site is static. Build it and run its tests before you push:

```bash
npm install --no-audit --no-fund
node site/build.js
node --test site/test_*.js
```

`npm install` gets the pinned build tools from `package.json`: Shiki for code
highlighting and Pagefind for the search index. Without them the build still
runs: code blocks fall back to the regex highlighter and the search index is
skipped. Do not commit `package-lock.json`. `node site/build-search.js` writes
the search index to `site/pagefind/` after the manuals build.

`site/build.js` writes `site/data.js` and many other generated files
(sitemaps, `site/langs.js`, the agent pages, hubs, and more; `.gitignore`
lists them). Never commit `site/data.js`; CI rebuilds it on every push to
main. A new static page needs an entry in `PAGES` in `lib/og-cards.js` for
its social card, as [Social cards](AGENTS.md#social-cards) describes.

### 9. Fix bugs or improve existing lessons

- Fix code that doesn't run
- Improve explanations
- Add better diagrams
- Update outdated information

## Guidelines

- **Code must run.** Every code file should execute without errors with the listed dependencies.
- **No inline comments in code.** The only comment is the short header that
  names the lesson doc and its spec sources. Use the docs for explanation.
- **Stdlib first.** Use only the dependencies on the [allowlist](AGENTS.md#dependencies).
- **Best language for the job.** Don't force Python where TypeScript or Rust is the better choice.
- **Build from scratch first.** Always implement the concept from first principles before showing the framework version.
- **Keep it practical.** Theory serves practice, not the other way around.
- **No AI slop.** Write like a human. Be direct. Cut filler.

## Checks before you push

Run the checks for what you changed. CI runs the same ones.

```bash
python3 scripts/audit_lessons.py                  # every lesson; add --phase N for one phase
python3 scripts/run_lesson_tests.py --phase NN-phase-name   # each lesson's own tests
python3 scripts/audit_certifications.py           # when certifications/ changes
node --test site/test_manuals.js && node scripts/audit_manuals.js --manual <id>   # manuals
node site/build-cheatsheets.js --check && node site/build-cheatsheets.js --check-quality   # cheat sheets
node site/build.js && node --test site/test_*.js  # site
```

`run_lesson_tests.py` skips lessons whose tests need a scientific dependency
you have not installed, and runs the rest.

## Pull Request Process

Sponsorship changes are not accepted through contributor pull requests. Sponsor
names, logos, links, and tier assignments are managed by the maintainer. See
[SPONSORS.md](SPONSORS.md) for sponsorship enquiries.

1. Fork the repository
2. Create a feature branch (`git checkout -b add-lesson-phase3-gradient-descent`)
3. Make your changes
4. Run the [checks](#checks-before-you-push) for what you changed
5. Submit a pull request with a clear description

### Commits

Size commits by judgment, not by a fixed count. A small fix is 1 or 2 commits.
A large change is a few logical commits, each one a step a reviewer can read
on its own. Use conventional subjects of 72 characters or less, such as
`feat(phase-NN/MM): <slug>`, `feat(manual/<id>): <section slug>`, or
`fix(site): <what>`. The body explains why.

Do not force-push a branch that has open review comments. A force-push
detaches them. To catch up with main, merge it in:
`git fetch origin main && git merge --no-edit origin/main`.

### Review bots

CodeRabbit and Devin review every pull request. Answer every thread they open:
fix the finding and say what changed, or reply with the reason it does not
apply. Then resolve the thread. A pull request with unanswered bot threads is
not ready for a maintainer review.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be kind, be helpful, be constructive.

## Style

- Direct prose. Cut filler. Match the manual's tone, not marketing copy.
- No decorative emojis in headings. Lang column emoji flags are the one
  exception and only because the parser maps them.
- Code runs as-is with the dependencies listed in the lesson.
- Build from scratch first, framework second.
