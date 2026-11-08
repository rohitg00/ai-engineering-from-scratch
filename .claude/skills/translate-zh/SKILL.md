---
name: translate-zh
version: 1.0.0
description: >
  Translate, sync and review the fork's 繁體中文 (zh-Hant, Taiwan) lesson
  translations: write a new docs/zh.md or quiz.zh.json, port the English changes
  a translated lesson has not absorbed, or review a translation against the
  house style and the Taiwan terminology rules. Every run ends on the fork's
  verification gates. Trigger phrases: "translate lesson to Chinese",
  "translate to zh", "sync the zh translation", "zh drift", "fix the zh lesson",
  "review the Chinese translation", "translate the quiz", "翻譯這一課",
  "同步中文翻譯".
tags: [i18n, zh-Hant, translation, fork-only]
---

# translate-zh

You maintain the fork's Traditional Chinese (Taiwan) layer over an English
curriculum. English is canonical. A translation is a mirror: same structure,
same code, same links, prose in natural Taiwan technical Chinese.

Fork-only. Upstream has no `docs/zh.md`. Read `docs/zh-translation.md` for the
current gap list before choosing work, `TRANSLATION-STYLE.md` for the house
style, and `CLAUDE.md` § *Translating a lesson body* for why the structural
rules below exist.

## Pick the mode

| The user wants | Mode | Start with |
|---|---|---|
| A lesson that has no `docs/zh.md` | **new** | `python3 scripts/i18n_status.py --next 10` |
| A lesson whose English changed after its translation | **sync** | `python3 scripts/zh_drift.py --kind content` |
| A `quiz.zh.json` | **quiz** | `python3 scripts/check_quiz_translations.py --lang zh` |
| A second opinion on an existing translation | **review** | `python3 scripts/zh_terms.py --files` |

One lesson per pass. Finish its gates before starting the next.

## Mode: new

1. Read `phases/<phase>/<lesson>/docs/en.md` in full, and two already-translated
   lessons from the same phase for voice and term choices.
2. Write `docs/zh.md` next to it, top to bottom, following **Structure** and
   **House style** below.
3. Run the gates. Fix, re-run, until clean.

For a long lesson (over ~5,000 words), translate it section by section, `##` by
`##`, and append each section to the file. Never summarize or drop a paragraph
to save length: the zh page replaces the English one for the reader.

## Mode: sync

1. `python3 scripts/zh_drift.py --diff phases/<phase>/<lesson>` prints the
   English diff since `docs/zh.md` last changed, with the upstream commit
   subjects. Commits named `fix(lessons): correct … source errors` or
   `correct lesson claims` change facts: the zh page currently teaches the old,
   wrong claim. Port those first.
2. Apply each hunk to the matching place in `docs/zh.md`:
   - **content hunk**: retranslate the changed sentence or paragraph. Keep the
     surrounding translation as it is; don't rewrite text the diff didn't touch.
   - **math hunk** (a code span like `` `π_θ` `` became `$\pi_\theta$`): copy the
     new LaTeX exactly, inline `$…$` or a ```` ```math ```` block, as the English
     has it.
   - a changed fenced code block: copy it byte for byte from `en.md`.
3. `python3 scripts/zh_drift.py --diff …` again must print `(no drift)` once
   you commit; before committing, re-read the diff against your edit.

`zh_drift.py` measures from the last commit that touched `zh.md`. If a lesson
was touched by a mechanical pass that did not sync it, pass `--since <rev>`.

## Mode: quiz

`quiz.zh.json` mirrors `quiz.json` exactly. Translate only `question`,
`options[]` and `explanation`. Never change `stage`, `correct`, question order
or option order: a moved `correct` index teaches the wrong answer, and nothing
in the Chinese would reveal it. Bare terms (`PPO`, `KV cache`) may stay English.
Keep the file's shape (bare list vs `{"questions": [...]}`).

## Mode: review

Read the lesson against `en.md` paragraph by paragraph and report, in order:
facts that differ from the English (including drift), missing or added content,
mistranslated technical terms, Mainland vocabulary, and awkward phrasing. Quote
the line and give the fix. Apply fixes only if the user asks.

## Structure (blocking: `i18n_status.py --verify` fails otherwise)

- Same headings, same levels, same order. Lesson pages derive anchor ids from
  the English headings by position, so a missing or extra heading misroutes
  every link below it.
- Same number of fenced blocks. Code blocks are copied verbatim, comments
  included: they mirror `code/main.*`.
- ```` ```figure ```` fences and the widget name inside them stay verbatim.
- ASCII diagrams inside fences stay English (CJK glyphs are double width).
- Same external links (URL unchanged; link text translated), same image paths.
  Image alt text is translated.
- Math stays math: `$…$` and ```` ```math ```` are copied exactly.

## House style

`TRANSLATION-STYLE.md` at the repo root is the style guide: metadata labels,
standard headings, exercise labels, Taiwan terminology, the two term
collisions (反向傳播 / 反向傳遞, 編解碼器 / 編碼器), punctuation. Read it, and one
lesson it names as a voice reference, before the first lesson of a session.
`scripts/zh_terms.py` machine-checks the parts that can be checked.

Decisions made since the guide was written, which the corpus already follows:

| English | Use | Note |
|---|---|---|
| `## Pitfalls`, `## Common Pitfalls` | 常見陷阱 | |
| `## Summary` | 總結 | |
| `### Hints` | 提示 | entries labelled `**練習 N。**` |
| reasoning | 推理 | inference stays 推論; never swap them |
| agent | 代理 | 2,800 uses in running prose; 代理程式 when the text means the program itself |
| quality | 品質 | 質量 only for physical mass |
| default | 預設 | 默認 only for tacit acceptance |
| user / client | 使用者 / 用戶端 | |
| capstone | 總結專案 | matches the site dictionary and `book/volumes.json` |

A half-width space between CJK and Latin letters or digits (`用 PyTorch 訓練 3 次`),
`「」` quotes (nested `『』`), and ` —— ` for a dash: every translated lesson
already does this.

## Gates (run all, from the repo root)

```bash
python3 scripts/i18n_status.py --verify              # structure parity
python3 scripts/check_quiz_translations.py --lang zh # quiz schema + no Simplified glyphs
python3 scripts/zh_terms.py --strict                 # Taiwan terms, headings, type label
python3 scripts/zh_drift.py --diff <lesson-dir>      # sync mode: nothing left unported
```

For a visual check, `node site/build.js`, serve `site/` and open
`lesson.html?path=phases/<phase>/<lesson>&lang=zh`: the page must show Chinese
prose, English-derived section anchors, rendered math and the quiz.

## Commit

One commit per lesson directory, per the repo convention:
`feat(i18n/phase-NN/MM): translate <slug> to zh-Hant` for a new translation,
`fix(i18n/phase-NN/MM): sync zh with <what changed>` for a sync. Open the PR in
the fork (`yennanliu/ai-engineering-from-scratch`), never upstream.
