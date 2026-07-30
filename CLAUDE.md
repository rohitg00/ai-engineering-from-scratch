# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A curriculum, not an application. 503 lessons across 20 phases (`phases/00-…` → `phases/19-…`),
plus a static website (`site/`) and an EPUB/PDF book pipeline (`book/`) that are both **generated
from the markdown**. The lessons are the product; the tooling exists to keep 503 of them coherent.

`AGENTS.md` is the authoritative contributor contract (hard rules, dependency allowlist, PR flow,
conflict-resolution recipes). Read it before opening a PR. Two of its claims have drifted from the
filesystem: it says 435 lessons (actually 503) and "5+ unit tests minimum" per lesson (only 59
lessons have tests at all — see *Running tests*).

## Commands

```bash
# Blocking CI gate — run before any PR touching phases/
python3 scripts/audit_lessons.py               # add --phase N to scope, --json for a report

# Website: README/ROADMAP/glossary -> site/data.js
node site/build.js                             # git diff site/data.js should show only a timestamp
                                               # change if your markdown edit was structural-safe

# Count drift (advisory on PRs; main self-heals on merge)
python3 scripts/build_catalog.py               # writes gitignored catalog.json (filesystem truth)
python3 scripts/check_readme_counts.py [--fix]

# Python smoke check across the curriculum (syntax-only by default)
python3 scripts/lesson_run.py --phase 14
python3 scripts/lesson_run.py --execute --strict   # actually runs, 10s timeout per file

# External-link validation (7-day cache in .link-cache.json)
python3 scripts/link_check.py --path README.md --strict

# Book volumes (needs pandoc; --pdf needs xelatex)
python3 scripts/build_book.py --assemble-only

# Scaffolding
scripts/scaffold-lesson.sh <phase-dir> <lesson-slug> ["Title"]
python3 scripts/install_skills.py <target_dir> --type skill --phase 14
```

### Running one lesson's code

```bash
cd phases/NN-phase/MM-lesson/code
python3 main.py                                # must exit 0, self-terminating, no stdin loops
npx tsx main.ts                                # TypeScript
rustc --edition 2021 main.rs -o /tmp/m && /tmp/m   # Rust: single file, stdlib only
julia main.jl                                  # Julia
```

Language spread: 435 `main.py`, 23 `main.ts`, 16 `main.jl`, 9 `main.rs`.

### Running tests

Tests exist in **59 lesson dirs, every one inside `phases/19-capstone-projects/`** — as
`code/tests/test_*.py` and/or `code/ts/tests/*.test.ts`. The other 444 lessons ship no tests, so
`audit_lessons.py` doesn't require them; `lesson_run.py` is the only automated check on their code.

```bash
cd phases/19-capstone-projects/20-agent-harness-loop-contract/code
python3 -m unittest discover tests -v          # all tests for the lesson
python3 -m unittest tests.test_loop -v         # one file
python3 -m unittest tests.test_loop.TestHarnessLoop.test_budget   # one test

cd phases/19-capstone-projects/09-code-migration-agent/code/ts
npx tsx --test tests/cost.test.ts              # one TS test file
```

Python test files `sys.path.insert` their parent `code/` dir, so run them from `code/`, not from
the repo root.

## Architecture: markdown is a build input

The single most important thing to internalize — three prose files are **parsed by machines**, so
a cosmetic edit can silently break the website:

```
README.md  ──┐
ROADMAP.md ──┼─> site/build.js ─> site/data.js ─> site/*.html (client-side render)
glossary/    │
  terms.md ──┘

phases/**/ ──> scripts/build_catalog.py ─> catalog.json (gitignored, filesystem truth)
                                              └─> check_readme_counts.py pins README's
                                                  hardcoded counts to catalog totals
```

Parser contracts that must stay intact (see `CONTRIBUTING.md` for the full list):

- **README lesson rows** must be markdown links: `| 01 | [Title](phases/14-agent-engineering/01-the-agent-loop/) | Build | Python |`.
  `site/build.js` derives every lesson URL from that link. Plain-text rows vanish from the site.
  Diagnostic: `grep -c 'tree/main/phases/NN-' site/data.js` returning 0 means Phase NN's rows lost
  their links.
- **ROADMAP status glyphs** (`✅` `🚧` `⬚`) are matched literally on phase headers and lesson rows.
  Never replace them with words.
- **Phase headers** in either `### Phase N: Name \`X lessons\`` or the `<details><summary>` form.
- Lesson table column shape `| # | Lesson | Type | Lang |` (capstones use `| # | Project | Combines | Lang |`).

`site/lesson.html` fetches `docs/en.md` and `quiz.json` at runtime from `raw.githubusercontent.com`,
so lesson prose ships without a site rebuild — but only for lessons the README already links.

### Translations (`site/i18n.js`)

`site/i18n.js` translates by **English source string**, not by key: `site/i18n.zh-Hant.js` maps
`'Contents' → '目錄'`. A `TreeWalker` pass plus a `MutationObserver` covers static HTML *and*
whatever `app.js` / `catalog.html` render from `data.js`, so **no page markup or renderer needs
touching to add a language** — only a dictionary and a `<script>` tag. A missing entry falls back to
English, which is what makes partial translation safe.

Two traps this design has already hit, both guarded in `translateText`:

- Never assign `nodeValue`/attributes unless the value actually changes. Writing an identical value
  still queues a mutation record, so any term that is the same in both languages (`PPO`, `StyleGAN`)
  becomes an infinite observer loop that hangs the page.
- Skip-tag membership must be exact. `'script,style,pre,code,…'.indexOf(tag)` matches `<p>` inside
  `"pre"` and `<a>` inside `"textarea"`, silently dropping those subtrees.

The 871 curriculum entries (phase names/descriptions, all 503 lesson titles, 83 glossary terms) are
generated by `python3 scripts/i18n_curriculum.py`, which reads the English side straight out of
`site/data.js` so a key can never drift from what the site renders, asserts the per-phase lesson
count, and is idempotent. The hand-written UI section above the generated marker is edited directly.

Lesson bodies are per-lesson files: `lesson.html` prefers `docs/zh.md` when the reader is in Chinese
and falls back to `docs/en.md` per lesson, so translated lessons light up as they land (the
`docs/<lang>.md` convention `CONTRIBUTING.md` already documents). Language resolution is
`?lang=` > `localStorage` > `navigator.language`; the toggle is injected next to `#themeToggle`.

### Site JS layout

Plain script tags, no bundler, no framework. `data.js` (generated) + `progress.js` (localStorage) +
`header.js` + `cmdpalette.js` on every page. Lesson pages additionally load `figures.js`,
`lesson-figures.js`, and a dozen `figures-<topic>.js` registries. A fenced block in `docs/en.md`:

````
```figure
kv-cache
```
````

renders as `<div class="lesson-figure" data-figure="kv-cache">`, hydrated by `lesson-figures.js`.
140 such fences exist. Adding a new figure name means registering it in the matching
`figures-<topic>.js` and confirming that file is script-tagged in `site/lesson.html`.

## Lesson directory contract

```
phases/NN-phase-slug/MM-lesson-slug/
├── docs/en.md      # required; H1 + hook + Type/Languages/Prerequisites/Time + Learning Objectives
├── code/           # required, non-empty; main.py / main.ts / main.rs / main.jl
├── quiz.json       # 338 of 503 lessons have one
├── outputs/        # 388 skill-*.md / prompt-*.md / agent-*.md artifacts
├── notebook/       # often just .gitkeep
└── assets/         # SVG diagrams
```

`docs/en.md`'s `**Languages:**` field must match the `main.*` files actually present in `code/`.

`audit_lessons.py` enforces rules **L001–L010**: dir naming, `docs/en.md` presence/UTF-8/min-200-bytes/H1,
non-empty `code/`, `quiz.json` schema, and resolvable internal markdown links. It is currently clean
(0 issues) — keep it that way.

**quiz.json is schema-fragile.** Exactly 6 questions (1 `pre`, 3 `check`, 2 `post`), keys
`stage`/`question`/`options`/`correct`/`explanation`, `correct` zero-indexed, 2–6 options. The legacy
`q`/`choices`/`answer` shape crashes the site renderer silently.

## Generated files

| File | Status |
|---|---|
| `site/data.js` | **committed**, but rebuilt and auto-committed by CI on push to main — don't hand-edit |
| `catalog.json` | gitignored, built on demand |
| `site/sitemap.xml`, `site/llms.txt`, `site/build-meta.js` | gitignored, regenerated per Vercel deploy |
| `README.md` counts | auto-fixed by CI on push to main (badges, prose totals) |
| `book/_build/`, `dist/book/` | gitignored |
| `package-lock.json` | never tracked |

You still own by hand: README lesson-link rows, ROADMAP status rows, `glossary/terms.md` entries for
terms used by more than one lesson, and `CHANGELOG.md`.

## Dependencies (stdlib-first)

Python: `numpy`, `torch`, `h5py`, `zstandard`, `safetensors`, stdlib. TypeScript: `hono`, `zod`, `ws`,
`@hono/node-server`, Node 20+ stdlib. Rust: stdlib only. Julia: `Random`, `Statistics`,
`LinearAlgebra`, `Printf`. Scripts in `scripts/` are stdlib-only Python 3.10+ (no `requests`).
`requirements.txt` is the learner-facing superset, not the allowlist for new lesson code.

If a suggestion needs a banned dep, decline it with "stays stdlib-first for educational clarity."

## Conventions

- **One commit per lesson directory.** A 10-lesson PR has 10 commits. Subject ≤72 chars:
  `feat(phase-NN/MM): <slug>`. Bug fixes name the actual defect —
  e.g. `fix(phase-02/15): forecast fed the lag vector in reverse order`.
- Mermaid or SVG for diagrams; no ASCII/Unicode box-drawing in lesson docs.
- Every fenced code block carries a language tag.
- **No comments inside lesson code** — explanation lives in `docs/en.md`. The exception is the
  required 4–6 line header comment citing the lesson's `docs/en.md` path and any RFC/spec/paper.
- Build from scratch first, framework second ("Build It / Use It"). Original implementations only;
  cite RFCs, specs, and papers, never other curriculum repos.
- Prose style: direct, no filler, no decorative emoji in headings (the Lang-column emoji flags are
  the one exception because the parser maps them).
- A `# requires: pkg1, pkg2` first-line comment makes `lesson_run.py --execute` skip a heavy lesson.
  No lesson uses it yet; it's available when adding one that needs torch or an API key.

## Local skills

`.claude/skills/check-understanding/` and `.claude/skills/find-your-level/` ship with the repo
(tracked despite `.claude/` being in `.gitignore`) — a phase quiz and a placement quiz that read
the curriculum's own `quiz.json` files.
