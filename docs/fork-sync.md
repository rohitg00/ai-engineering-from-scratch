# Syncing this fork with upstream

How to merge `rohitg00/ai-engineering-from-scratch` into `yennanliu/ai-engineering-from-scratch`
without breaking the fork's Traditional Chinese (zh-Hant) site, its GitHub Pages deploy, or its CI.
Written after the 2026-11 sync (#36). The log at the bottom records what each sync ran into, so
check it before starting.

This file is fork-only. Upstream has no copy of it.

## What the fork adds on top of upstream

Each sync can break one of these, and upstream's CI tests none of them:

| Fork layer | Lives in | Breaks when upstream… |
|---|---|---|
| zh-Hant site chrome | `site/i18n.js`, `site/i18n.zh-Hant.js`, `<script>` tags in each page | rewrites a page's `<script>` block, or adds lessons, phases or glossary terms |
| zh lesson bodies | `phases/**/docs/zh.md` | edits a lesson's `docs/en.md` |
| zh quizzes | `phases/**/quiz.zh.json` | edits a lesson's `quiz.json` |
| Lesson loading for zh | `site/lesson.html` and `site/lesson-markdown.js` (`DOC_CODE`, `canonHeadings`, `withCanonHeadings`) | refactors how lessons are fetched or rendered |
| GitHub Pages deploy | `.github/workflows/pages.yml`, `scripts/pages_aliases.mjs` | changes `vercel.json` (`buildCommand` or `rewrites`) |
| Demo code section | `README.md` and every `i18n/<lang>/README.md` | restructures the README |
| Fork-only CI | `.github/workflows/fork-tooling.yml` | any of the above |

`CLAUDE.md` lists the fork-only files and the fork edits to upstream workflows. Keep both lists current.

## Steps

### 1. Branch and merge

```bash
git checkout main && git pull
git fetch upstream && git fetch origin
git log --oneline --first-parent main..upstream/main | wc -l      # size of the sync
git checkout -b sync/upstream-YYYY-MM                              # this exact prefix: interviews.yml keys on it
git merge --no-ff --no-commit upstream/main
git diff --name-only --diff-filter=U                               # conflicted files
```

Always use the `sync/upstream-` prefix. `.github/workflows/interviews.yml` skips its generated-README
check only on branches with that prefix.

### 2. Resolve conflicts

The same files conflict every time. Default resolutions:

| File | Resolution |
|---|---|
| `README.md`, `i18n/*/README.md` | Take upstream's version and put the fork's `## Demo code` block back where it was (above `<details>`). |
| `site/*.html` `<script>` lines | Take upstream's line (newer `?v=` versions) and re-insert `i18n.zh-Hant.js` and `i18n.js` before `data.js`. Never re-add `langs.js`, `lang-picker.js` or `<div id="langPicker">`. |
| `site/lesson.html` | Keep upstream's structure and re-port the fork's zh logic (see below). |
| `site/header.js` | Keep the fork's removal of the `ensureUiI18n()` call. Upstream's Simplified `ui-i18n` would override zh-Hant. |
| `site/data.js` | Take upstream's, then run `node site/build.js`. |
| `.gitignore` | Keep both sides: the fork's alias-stub block and any new upstream entries. |
| `CONTRIBUTING.md`, `docs/i18n.md` | Take upstream's text, then append the fork's hand-written zh rules as a fork note. |
| `.github/workflows/*` | Keep the fork edits that `CLAUDE.md` lists. A modify/delete conflict on a workflow the fork deleted resolves with `git rm`. |

The fork's zh logic in `site/lesson.html` comes down to four things:

1. A lesson loads `docs/zh.md` and `quiz.zh.json` from this repo (`DOC_CODE`, `fetchLessonDocument(lang, enPath, docPath)`), never from upstream's `translations` branch.
2. When `headingsAlign(enMd, md)` fails, the page falls back to English, and `quizFor(lang)` keeps the quiz in the same language as the body.
3. Heading ids come from the English headings (`canonHeadings`), passed in through `window.AIFSLessonMarkdown.withCanonHeadings(...)`. Upstream tests pin the literal `parseMd(md, { renderCode: … })` call, so leave that line byte-identical to upstream's.
4. `currentLang()` comes from `window.I18N`, and `applyRenderedLanguage` stamps only `#lessonContent`.

Commit the merge with only the conflict resolution in it: `Merge upstream/main into the fork (N commits)`.
Then confirm the branch deletes nothing (see `CLAUDE.md`):

```bash
git diff --diff-filter=D --name-only main..HEAD
```

### 3. Repair the fork layers

Each item gets its own commit. Run the check first; it shows how much work there is.

**zh quizzes**

```bash
python3 scripts/check_quiz_translations.py --lang zh       # must print "clean"
```

It only catches a `correct` index that moved. Also list every `quiz.json` upstream changed that has a
`quiz.zh.json`, and retranslate those questions:
`git diff --name-only <merge-base> upstream/main -- 'phases/**/quiz.json'`.
Upstream often rewrites the wrong options (distractors) without moving the answer.

**zh lesson bodies**

```bash
python3 scripts/i18n_status.py --verify                    # must report 0 with problems
```

Work in this order:

1. **Mechanical pass.** Where the fence count matches, copy every fenced block from `en.md` into
   `zh.md` verbatim, since the fork's rules keep fences verbatim. Where exactly one URL changed,
   update the link. This cleared about 30% of the drift in 2026-11.
2. **Translation pass.** For each lesson still failing, save
   `git diff <merge-base> upstream/main -- <lesson>/docs/en.md` and apply the same change to `zh.md`:
   translate the new prose, drop removed prose, leave unchanged passages alone. Batches of about
   600 changed lines per agent worked well, using a shared brief that points at
   `TRANSLATION-STYLE.md`.
3. **House terms.** New headings need one agreed translation. So far: `### Hints` is `### 提示`,
   with entries labelled `**練習 N。**`; `## Summary` is `## 總結`.

`--verify` checks structure only, so it can't see prose changes. `zh_drift.py` can:

```bash
python3 scripts/zh_drift.py --kind content     # lessons whose English wording changed
python3 scripts/zh_drift.py --diff <lesson>    # the English hunks to port
python3 scripts/zh_terms.py --strict           # house terms and standard headings
```

Record the before and after counts in the sync log. Any commit that rewrites `zh.md` without
porting the English (the mechanical pass in step 1, a terminology sweep) gets a `Zh-Sync: none`
trailer in its message, or `zh_drift.py` treats it as a full sync and hides the drift behind it.
The 2026-11 mechanical pass predates the trailer; `LEGACY_NO_SYNC` in the script lists it.

**zh-Hant curriculum dictionary**

```bash
python3 scripts/i18n_curriculum.py && python3 scripts/test_i18n_curriculum.py
```

If it exits with `phase N: X translations for Y lessons`, append zh-Hant titles to `TITLES_ZH[N]` in
`scripts/i18n_curriculum.py`. To find the new or renamed lessons, compare `site/data.js` on `main`
with the new build, then rerun the script.

**README locales**

```bash
python3 scripts/audit_readme_locales.py && python3 scripts/build_readme_i18n.py --check
```

Every locale README needs the `## Demo code` section with a translated heading and the repo name as
a code span: `` [`ai-engineering-from-scratch-demo`](…) ``. Upstream adds locales over time, so
add the section to new ones. Once the locales are reviewed, record the English source digest:

```bash
python3 -c "import sys; sys.path.insert(0,'scripts'); import audit_readme_locales as a; \
a.SOURCE_DIGEST.write_text(a.source_fingerprint(a.SOURCE.read_text(encoding='utf-8'))+'\n', encoding='utf-8')"
```

**GitHub Pages**

```bash
git diff <merge-base> upstream/main -- vercel.json package.json
node --test scripts/test_pages_aliases.mjs
```

- If `vercel.json`'s `buildCommand` changed, mirror it in the `build` job of `pages.yml`, leaving
  out the Vercel-only steps (`fetch-translation-coverage`, `clean-urls`).
- If `rewrites` gained a new shape, check that `pages_aliases.mjs` handles it.
- Then build the site the way Pages does (step 4).

### 4. Verify locally before pushing

```bash
python3 scripts/audit_lessons.py
for t in site/test_*.js; do node --test "$t" 2>&1 | grep -q '^# fail 0' || echo "FAIL $t"; done
for t in scripts/test_*.py; do python3 "$t" >/dev/null 2>&1 || echo "FAIL $t"; done
```

Three Python tests also fail on unmodified upstream and can be ignored locally:
`test_agent_readiness` (needs a build), `test_book_rendering` (needs pandoc), and `test_link_check`
(run it as `python3 -m unittest scripts.test_link_check`).

Pages build, from a clean worktree, the same steps as `pages.yml`:

```bash
git worktree add /tmp/pagesbuild HEAD && cd /tmp/pagesbuild && npm install --no-audit --no-fund
node site/build.js && node site/build-projects.js --strict && node site/build-agents.js \
  && node site/build-manuals.js && node site/build-search.js && node site/version-assets.js \
  && node scripts/pages_aliases.mjs
find site -name '*:*'                       # must print nothing
```

Then serve the build under the `/ai-engineering-from-scratch/` subpath on a non-localhost hostname.
On `localhost`, `content-source.js` reads local files instead of GitHub, so the check proves less.
Load the pages in headless Chrome:

```bash
mkdir -p /tmp/pr && ln -sfn /tmp/pagesbuild/site /tmp/pr/ai-engineering-from-scratch
(cd /tmp/pr && python3 -m http.server 8766 &)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --host-resolver-rules="MAP fork.test 127.0.0.1" --virtual-time-budget=15000 --dump-dom \
  "http://fork.test:8766/ai-engineering-from-scratch/lesson?path=phases/02-ml-fundamentals/02-linear-regression&lang=zh-Hant"
```

Check:
- `#lessonContent` has `lang="zh-Hant"`, with Chinese text and English heading ids (`the-concept`, `build-it`).
- The page has 3 quiz sections.
- Code block and KaTeX counts match the English page.
- Clean URLs load: `glossary/<term>`, `interviews/`, `manual-<slug>`.

### 5. Push and open the PR

```bash
git push -u origin sync/upstream-YYYY-MM
```

`gh pr create` fails here (see `CLAUDE.md`), so open the PR from
`https://github.com/yennanliu/ai-engineering-from-scratch/compare/main...sync/upstream-YYYY-MM?expand=1`.

Watch CI with a slow poll, at least 90 seconds apart. Polling every 30 seconds while the agents
worked used up the 5,000/hour GitHub API limit in 2026-11. `gh run rerun <id> --failed` works only
after the whole run has finished.

## Sync log

### 2026-11: #36, `sync/upstream-2026-11`, 254 upstream commits (to `e9fb44680`)

Conflicts: 21 files. They were the README and 12 locale READMEs, `site/lesson.html` (8 hunks), three
other pages' script tags, `site/data.js`, `CONTRIBUTING.md`, `docs/i18n.md` and `.gitignore`.

| Problem | Fix |
|---|---|
| Upstream moved the markdown parser out of `lesson.html` into `site/lesson-markdown.js` (Shiki code, KaTeX) | Re-ported the zh logic. `canonHeadings` now enters through `withCanonHeadings()` and covers `h4`. |
| Two upstream tests pin the literal `parseMd(...)` call (`site/test_lesson_code.js`, `scripts/test_seo_routes.js`) | Left the call byte-identical and edited neither test. |
| 9 `quiz.zh.json` files had stale distractors, and 2 had a wrong answer key | Retranslated the changed questions. |
| 382 formula fences across 105 `zh.md` files were now `math` (LaTeX) | Copied them from `en.md`; each zh block had been verbatim old English. |
| 76 `zh.md` files drifted (new `### Hints`, LaTeX prose, A2A 1.0.1 rewrites, new figures and links) | Mechanical pass, then 6 translation agents working from per-lesson diffs. |
| 19 new lessons were missing from `TITLES_ZH` | Added the titles. |
| New README locale audit: 33 locales must match the English layout, including Demo code | Translated the section into every locale and recorded the source digest. |
| `interviews.yml` rejects any PR that changes the generated `interviews/**/README.md` | Skips that step on `sync/upstream-*` branches. |
| `site/test_manuals.js` hard-coded `rohitg00` in evidence links | Changed it to accept any repo owner. |
| `pages_aliases.mjs` wrote `/glossary/:page(...)` as literal directories and replaced `interviews/index.html` with a redirect to itself | Now expands parameters against the built site, never overwrites a real page, and skips sources with a file extension. |
| `pages.yml` built only `data.js`, so manuals, projects, agents, search and Shiki code were missing | Mirrors `vercel.json`'s `buildCommand`, and builds on PRs too. |
| `cheatsheets-generate.yml` (weekly) and `practice-generate.yml` spent an API key on upstream content | Deleted. Kept `interviews-generate.yml` and `translate.yml`, which upstream tests read and which do nothing here. |

Flaky: `lesson tests (stdlib)` failed once on upstream's new lesson 17/29 (`model-demo-interfaces`).
It passed in 40 of 40 local runs, so re-run it before investigating.

### 2026-10: #35, `sync/upstream-2026-10`, merged 2026-09-30

| Problem | Fix |
|---|---|
| 57 `zh.md` files drifted from upstream `en.md` fixes | `fix(i18n): zh lessons drifted from 57 upstream en.md fixes` |
| 3 zh quiz questions kept wording that upstream had rewritten | Retranslated them. |
| A new `/sponsors` rewrite produced an untracked alias stub | Added it to the `.gitignore` alias block. |
| `header.js` loaded upstream's Simplified `ui-i18n` over zh-Hant | Removed the `ensureUiI18n()` call. |

### 2026-09: #33, `sync/upstream-2026-09`, merged 2026-09-12

| Problem | Fix |
|---|---|
| `/lesson` alias pointed at the serverless function, which Pages can't run | `pages_aliases.mjs` maps `/api/lesson` to `lesson.html`. |
| A site test expected upstream's source URL | It now derives the URL from the build's own repo. |
| 12 new phase-14 lessons had no zh-Hant titles | Added the titles. |
| The pt and ru READMEs fell out of sync with the fork's English | Regenerated them. |
| A zh quiz (phase-01/02) lost a question and its stages | Restored them. |
| Fork-only scripts had no CI | Added `fork-tooling.yml` and tests for the alias generator, the curriculum dictionary, translation coverage and the quiz validator. |

## Patterns

Each sync so far has run into the same things:

- **zh drift.** Every sync drifts `zh.md` and `quiz.zh.json`: 57 lessons in 2026-10 and 76 in
  2026-11. Budget translation time for it, and start with the mechanical pass.
- **New lessons.** New upstream lessons mean new entries in `TITLES_ZH`.
- **Clean URLs.** Changes to `vercel.json` break Pages. `pages_aliases.mjs` and `pages.yml` exist
  only on this fork, so upstream's CI never sees the breakage.
- **Upstream tests.** Upstream tests pin upstream's exact strings. Make the fork code fit them
  before editing a test. Each edited test is another conflict on every sync.
