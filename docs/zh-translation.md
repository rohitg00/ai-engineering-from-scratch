# 繁體中文 (zh-Hant) translation: gaps and improvements

Fork-only. A review of the fork's Traditional Chinese layer, taken on 2026-11-08 at `main`
`17006941f` (right after the 2026-11 upstream sync, #36). Every number below comes from a command in
the last column, so rerun it rather than trusting this snapshot.

What exists today: lesson bodies (`phases/**/docs/zh.md`), quizzes (`quiz.zh.json`), the site
dictionary (`site/i18n.zh-Hant.js`: interface strings, every phase name, lesson title and glossary
term), 33 README locales including `zh-TW`, and the zh-Hant book edition. `TRANSLATION-STYLE.md` is
the style guide; `.claude/skills/translate-zh/` is the agent workflow for all of the work below.

## Gaps

### 1. Lessons with no translation: 31 of 542 (131,306 words, 12.4%)

| Phase | Lessons | Words | Note |
|---|---|---|---|
| 13 tools and protocols | 32–45 (14) | ~101,000 | The reverse-engineering track. Longest lessons in the course (5,000–8,700 words each) |
| 14 agent engineering | 43–54 (12) | ~8,800 | Short lessons (550–1,700 words). Cheapest phase to finish |
| 02 ML fundamentals | 19–21 (3) | ~10,600 | ML system design, monitoring and drift, feature stores |
| 00 setup and tooling | 13 (1) | ~6,800 | Python for AI engineering |
| 17 infrastructure | 29 (1) | ~5,300 | Model demo interfaces |

Source: `python3 scripts/i18n_status.py --next 40`.

### 2. Quizzes with no translation: 31 of 392

Exactly the 31 lessons above: every translated lesson that has a quiz also has `quiz.zh.json`.
Translate each quiz together with its lesson. Source: `python3 scripts/check_quiz_translations.py`.

### 3. Translations behind their English: 232 lessons

This is the largest gap, and it is invisible on the site. `i18n_status.py --verify` checks
*structure* only (headings, fences, links), so when upstream corrects a claim in a paragraph, the
check stays green and the zh page keeps teaching the old claim. The 2026-11 sync repaired the 76
lessons `--verify` flagged; the rest of upstream's prose edits had no detector until
`scripts/zh_drift.py`.

| | Lessons | Changed passages (hunks) |
|---|---|---|
| Wording changed (fix these first) | 198 | 455 |
| Math notation only (`` `π_θ` `` became `$\pi_\theta$`) | 34 | 612 total, across both rows |

Most of the wording changes come from upstream's correctness sweeps: `fix(lessons): correct phase N
… source errors` (phases 12, 13, 14, 15, 16, 17, 18, 19), `source errors from #585` (phases 00–11),
and `correct lesson claims found in interview reviews` (#749). Each one fixes a fact, a number or a
citation.

By phase, lessons with wording drift: 19 → 38, 12 → 17, 17 → 15, 04 → 14, 10 → 14, 14 → 14,
02 → 12, 18 → 10, 08 → 9, 13 → 9, 03 → 8, 05 → 8, 07 → 8, 11 → 6, 15 → 5, 16 → 5, 09 → 3, 06 → 2,
01 → 1. The most-changed: 12/17 video-language temporal grounding, 10/18 multi-token prediction,
02/05 SVMs, 03/03 backpropagation, 02/03 logistic regression, 02/06 kNN, 12/08 LLaVA-OneVision.

Quizzes have no drift: the 2026-11 sync retranslated every rewritten question.

Source: `python3 scripts/zh_drift.py` (table), `--kind content`, `--phase N`,
`--diff <lesson-dir>` (the English to port).

### 4. Math renders as code on the zh page: ~122 lessons

Part of gap 3, listed separately because it is a visible rendering difference, not a wording one.
Upstream's KaTeX migration (#598) turned inline code spans and plain-text formulas into `$…$` and
```` ```math ```` in `en.md`. The 2026-11 sync copied the rewritten formula *blocks* into `zh.md`, but
not the inline math in prose, so a Chinese reader sees `` `R_φ(x, y)` `` where the English reader
sees typeset math. Each one is a mechanical copy from the English diff; `zh_drift.py` labels these
hunks `math`.

### 5. Pages that never load the Chinese dictionary

`site/i18n.js` translates any page that includes it, but only 9 of 24 top-level pages do, and none
of the generated sections do. A reader who switches to Chinese and then follows the main navigation
lands on English with no language toggle:

| Pages | Count |
|---|---|
| `learning-paths`, `projects`, `project`, `skills`, `how-to-learn`, `highlights`, `sponsors`, `blogs`, `developer`, `contact`, `privacy`, `404`, three `inside-*` explainers | 15 |
| Generated `site/hubs/` (glossary and topic hubs) | 257 |
| Generated `site/interviews/` | 566 |
| Generated `site/cheatsheets/` | 156 |
| Generated `site/practice/` | 64 |

The generated pages are built by upstream's `site/build-*.js`. Patching those generators would
conflict on every sync. A fork-only post-build step in `pages.yml` (the way `pages_aliases.mjs`
works) that adds the two `<script>` tags to every built page avoids that.
Source: `grep -L 'i18n.zh-Hant.js' site/*.html`.

### 6. Content that is English-only

By policy or by default, not by oversight. Listed so the choice is explicit:

- Manuals (`manuals/`), the interview bank (`interviews/`), cheat sheets, practice problems, the
  projects section and learning-path descriptions.
- Certification curricula: English-only on purpose (`docs/i18n.md`).
- Lesson `outputs/` artifacts (388 `skill-*.md` / `prompt-*.md` files): they are prompts for agents,
  and the site renders them as-is.
- Code comments and ASCII diagrams inside fences: verbatim by rule (`TRANSLATION-STYLE.md`).

## Improvements (content and translation quality)

### Done in this PR

- **Standard section headings.** 303 `##` headings used a non-standard rendering of a recurring
  section: `Build It` appeared as 動手實作, 建構它, 動手建 and 實作; `The Problem` as 問題所在 and
  那個問題 (a literal "the"). All now follow `TRANSLATION-STYLE.md`. Anchors do not change, because
  `lesson.html` derives heading ids from the English.
- **Type labels.** 69 lesson headers used 建構 for *Build* or 綜合專案 for *Capstone*; they now read
  實作 and 總結專案, matching the style guide, the site dictionary and `book/volumes.json`.
- **Mainland vocabulary.** 7 unambiguous Mainland terms fixed (用戶 → 使用者, 緩存 → 快取,
  鏈接 → 連結, 示例 → 範例, 字符 → 字元).
- All three are now CI checks (`zh_terms.py --strict` in `fork-tooling.yml`), so they cannot come
  back.

### Needs a human: 1,656 warn-tier terms

`python3 scripts/zh_terms.py` lists terms that are usually Mainland usage but correct in some
context, so they are not auto-fixed. The largest:

| Term | Count | Judgement needed |
|---|---|---|
| 函數 | 347 | 函式 for a code function; 函數 stays for a math function |
| 算法 | 280 | 演算法 almost everywhere: the style guide already says so. Best next mechanical pass, after a skim |
| 激活 | 272 | 激活函數 is common in Taiwan ML writing; 啟用 for "activate a feature" |
| 登錄 | 173 | 登錄 is right for a registry, 登入 for sign-in |
| 項目 | 119 | 專案 for a project, 項目 for an item |
| 支持 | 72 | 支援 for software support |

`--show <term>` prints every line, so one pass per term is a short review.

### Term consistency the linter cannot decide

- **推論 vs 推理** (549 vs 367). The style guide reserves 推論 for *inference*; 推理 is right only for
  *reasoning*. Reasoning-model lessons use 推理 correctly, but some serving lessons likely use it for
  inference. Needs a read of the 367.
- **token: 詞元 vs 標記** (2,784 vs 215). Some 標記 are correct (a *tag* or *marker*); the rest
  should be 詞元.
- **agent: 代理 vs 代理程式** (2,838 vs 174). The guide says 代理程式; the corpus settled on 代理. The
  skill now records 代理 as the running-prose choice. Update the guide or the corpus, not both.
- **context: 上下文 vs 脈絡** (325 vs 674). 上下文 for the LLM context window, 脈絡 for "situation".
- **capstone in prose: 綜合專案 vs 總結專案** (91 vs 33). Labels are standardized; prose is not.

### Process

- **No translation records its English source.** Drift is measured from git history, which a
  mechanical commit over `zh.md` silently resets. Such commits now carry a `Zh-Sync: none` trailer
  (and `zh_drift.py` skips the one older commit that predates it). Every sync should run
  `zh_drift.py` and record the counts in `docs/fork-sync.md`.
- **Translate a lesson and its quiz together**, and run the gates in the skill before committing.
- **`TRANSLATION-STYLE.md` drifted** from practice. It said quizzes stay English (361 are
  translated) and lacked the Pitfalls, Summary and Hints headings. Updated in this PR.

## Suggested order

1. Port the wording drift (gap 3), worst phases first. Readers are being taught claims the English
   no longer makes.
2. Copy the inline math (gap 4). Mechanical, and it can share a pass with item 1.
3. Load the dictionary on the remaining pages (gap 5) with a post-build step.
4. Phase 14 lessons 43–54 and their quizzes (gaps 1–2). About 9,000 words, which finishes a phase.
5. Phase 02 19–21, 00/13 and 17/29, then the phase 13 reverse-engineering track.
6. Review the warn-tier terms, one term per pass.

## Tools

| Tool | What it does |
|---|---|
| `scripts/i18n_status.py` | Coverage per phase, next lessons to translate, structural `--verify` |
| `scripts/check_quiz_translations.py` | Quiz schema parity and no Simplified glyphs |
| `scripts/zh_drift.py` | **New.** English changes a translation has not absorbed, classified wording vs math |
| `scripts/zh_terms.py` | **New.** Taiwan terminology, standard headings and type labels; `--fix` for the safe ones |
| `scripts/i18n_curriculum.py` | Regenerates the curriculum section of `site/i18n.zh-Hant.js` |
| `.claude/skills/translate-zh/` | **New.** Agent workflow: new lesson, sync drift, quiz, review |
