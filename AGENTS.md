# AGENTS.md

このリポジトリを扱うコントリビューターと AI エージェント向けの運用マニュアルです。PR を開く前に読んでください。

このリポジトリは SaaS アプリではなく、カリキュラムです。プロダクトはレッスンそのものです。以下のルールは、435 レッスンの一貫性を長期的に保つためのものです。

---

## 哲学

435 レッスン。20 フェーズ。どのアルゴリズムも、フレームワークを 1 つでも import する前に、生の数学から組み立てます。backprop、tokenizer、attention mechanism、agent loop を Python、TypeScript、Rust、Julia のいずれかで手書きします。その後、同じ操作を本番用ライブラリで実行し、フレームワークをブラックボックスではなくします。"作る / 使う" の分割が背骨です。各レッスンは、日々のワークフローに差し込める再利用可能な成果物を出荷します。

---

## リポジトリ構成

```
phases/
  NN-phase-slug/
    NN-lesson-slug/
      docs/en.md              # lesson explainer
      code/                   # implementation + tests
      quiz.json               # 6 questions
      outputs/                # reusable artifact (skill / prompt / agent / MCP server)
README.md                     # public face; lesson counts auto-synced
ROADMAP.md                    # phase/lesson status
glossary/terms.md             # canonical term definitions
site/
  build.js                    # parses README + ROADMAP + glossary -> data.js
  data.js                     # generated; rebuilt by CI on main push
scripts/                      # automation
.github/workflows/
  curriculum.yml              # invariant + auto-sync workflow
```

---

## 厳格なルール

1. **レッスンディレクトリごとに 1 コミット。** 複数のレッスンを 1 コミットにまとめないでください。10 レッスンの PR には 10 コミットが必要です。
2. **Conventional commit の件名** は 72 文字以下: `feat(phase-NN/MM): <slug>`。本文では「何を」ではなく「なぜ」を説明します。
3. 図は **Mermaid または SVG のみ**。ASCII / Unicode box-drawing は使いません。
4. **すべての fenced code block に language tag が必要です。** 必要に応じて `text`、`json`、`python`、`typescript`、`rust`、`julia`、`bash`、`console`、`mermaid`、`yaml` を使います。
5. **実装はオリジナルのみ。** ドキュメント、コードコメント、コミット文で外部カリキュラムリポジトリを引用しないでください。正典となる情報源が RFC、公式仕様、学術論文である場合は、それらを引用します。
6. **依存関係の allowlist**（下の「依存関係」を参照）。stdlib-first。
7. **生成ファイルを commit しない:** `catalog.json` は gitignored、`site/data.js` は CI で再ビルド、`package-lock.json` は追跡しません。

---

## 依存関係

| 言語       | 許可されるもの                                                           |
|------------|--------------------------------------------------------------------------|
| Python     | `numpy`, `torch`, `h5py`, `zstandard`, `safetensors`, stdlib              |
| TypeScript | `hono`, `zod`, `ws`（WebSockets が必要な場合のみ）, `@hono/node-server`, Node 20+ stdlib |
| Rust       | stdlib のみ（single-file `rustc --edition 2021`）                         |
| Julia      | `Random`, `Statistics`, `LinearAlgebra`, `Printf` (Julia stdlib)          |

指摘が禁止された依存関係を提案している場合は、理由を "stays stdlib-first for educational clarity." としてスキップしてください。

---

## レッスンの契約

### docs/en.md frontmatter

```markdown
# <Title>

> <One-line hook>

**種別:** <Learn | Build | Reference>
**言語:** <comma-list matching the main.* files in code/>
**前提条件:** <comma-list of upstream lessons, or "None">
**所要時間:** ~<estimate in minutes>

## Learning Objectives
- <4-6 bullet points starting with a verb>
```

`**言語:**` フィールドは、`code/` にある `main.*` ファイルの言語と一致していなければなりません。

### quiz.json schema

```json
{
  "lesson": "<dir-slug>",
  "title": "<Lesson Title>",
  "questions": [
    {"stage": "pre",   "question": "...", "options": ["a","b","c","d"], "correct": 0, "explanation": ""},
    {"stage": "check", "question": "...", "options": ["a","b","c","d"], "correct": 1, "explanation": ""},
    {"stage": "check", "question": "...", "options": ["a","b","c","d"], "correct": 2, "explanation": ""},
    {"stage": "check", "question": "...", "options": ["a","b","c","d"], "correct": 1, "explanation": ""},
    {"stage": "post",  "question": "...", "options": ["a","b","c","d"], "correct": 3, "explanation": ""},
    {"stage": "post",  "question": "...", "options": ["a","b","c","d"], "correct": 0, "explanation": ""}
  ]
}
```

問題数は正確に 6 問です: pre 1 問 + check 3 問 + post 2 問。`correct` はゼロ始まりです。サイトレンダラーが理解できるのはこの形だけです。古い `q/choices/answer` スキーマは静かにクラッシュします。

### code/

- その言語の標準コマンドでエンドツーエンドに実行でき、終了コード 0 で終わること。
- デモは自分で終了すること。無限の stdin ループや、API キー不足によるハングを入れないこと。
- レッスンの `docs/en.md` パスと、仕様または RFC の出典を示す 4-6 行のヘッダーコメントを含めること。

### code/tests/

- 最低 5 件の unit tests。
- その言語の stdlib runner で実行すること（`python3 -m unittest discover`、`npx tsx --test`、Rust/Julia inline）。

---

## PR ごとの検証

push 前にローカルで実行してください。

```bash
python3 scripts/audit_lessons.py
python3 scripts/check_readme_counts.py        # advisory — CI fixes on merge

# For each lesson touched:
cd phases/NN-phase/MM-lesson/code
python3 main.py && python3 -m unittest discover tests -v   # or the lang equivalent
```

CI ゲート（`.github/workflows/curriculum.yml`）:

| ジョブ                           | トリガー     | 挙動                                                  |
|----------------------------------|--------------|-------------------------------------------------------|
| `audit`                          | push + PR    | `audit_lessons.py` を実行。必須。                    |
| `readme-counts-sync` (main only) | push to main | catalog を再ビルドし、README counts を自動修正。     |
| `site-rebuild` (main only)       | push to main | `node site/build.js` を再実行し、`site/data.js` を commit。 |
| `readme-counts-drift`            | PR           | 助言のみ。main は merge 時に自己修復。                |

---

## 自動化の契約

**CI が自動処理します。PR では触らないでください。**

| 対象                 | 処理                           | タイミング          |
|----------------------|--------------------------------|---------------------|
| `catalog.json`       | 必要時に再ビルド（gitignored） | すべての CI job     |
| `README.md` counts   | `readme-counts-sync`           | main への push 時   |
| `site/data.js`       | `site-rebuild`                 | main への push 時   |

**あなたが対応するもの:**

| 対象                          | タイミング                                                       |
|-------------------------------|------------------------------------------------------------------|
| `README.md` lesson-link rows  | 新しいレッスンを追加するとき。`[Title](phases/NN-phase/MM-lesson/)` でリンクする |
| `ROADMAP.md` status           | レッスンを complete または WIP にするとき                        |
| `glossary/terms.md`           | 複数レッスンで使う用語を導入するとき                             |

**よくあるバグ**: merge 後に `grep -c 'tree/main/phases/NN-' site/data.js` が 0 の場合、Phase NN の README 行がプレーンテキストで、`[Title](phases/NN-...)` の markdown link がありません。`site/build.js` はそのリンクから URL を導出します。

---

## コンフリクト解決

```bash
git fetch origin main
git merge --no-edit origin/main

# Catalog conflict (legacy branches only — catalog.json is gitignored now):
git rm catalog.json
git commit --no-edit

# README count conflict:
git checkout --theirs README.md
python3 scripts/build_catalog.py
python3 scripts/check_readme_counts.py --fix
git add README.md && git commit --no-edit

# site/data.js conflict:
git checkout --theirs site/data.js
node site/build.js
git add site/data.js && git commit --no-edit

git push origin <your-branch>
```

未解決の review comments があるブランチへ `git push --force` するのは避けてください。force-push するとそれらが切り離されます。

---

## 新規レッスンのオンボーディング

```bash
mkdir -p phases/NN-phase-slug/MM-new-lesson/{docs,code/tests,outputs}

# 1. Write docs/en.md with the frontmatter above.
# 2. Write code/main.<lang> with the 4-6 line header.
# 3. Write code/tests/test_main.* with 5+ tests.
# 4. Write quiz.json with the schema above.
# 5. (Optional) Add outputs/skill-<slug>.md if the lesson ships a skill.

# 6. Add to README.md:
#    | MM | [Lesson Title](phases/NN-phase-slug/MM-new-lesson/) | Type | Lang |

# 7. Update ROADMAP.md status row.

# 8. Validate locally.

# 9. Atomic commit:
git add phases/NN-phase-slug/MM-new-lesson README.md ROADMAP.md
git commit -m "feat(phase-NN/MM): add <slug>"
git push -u origin <your-branch>
gh pr create --title "feat(phase-NN/MM): add <slug>" --body "<5-line summary>"
```

`site/data.js` は merge 時に再生成されます。CI に任せてください。

---

最終レビュー: 2026-05-27。
