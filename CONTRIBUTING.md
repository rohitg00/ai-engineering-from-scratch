# 貢献ガイド

レッスン、翻訳、修正、outputs はすべて歓迎します。1 つの pull request につき 1 つの貢献にすると、レビューが速くなり、貢献者数やクレジットも正しく扱えます。

## 重要: README と ROADMAP は Web サイトの入力です

`site/build.js` は `README.md`, `ROADMAP.md`, `glossary/terms.md` を解析して `site/data.js` を生成します。これらのファイルに触れる pull request では、次のパターンを必ず保ってください。

- フェーズ見出しは `### Phase N: Name \`X lessons\`` 形式、または `<details><summary><b>Phase N — Name</b> ... <code>X lessons</code> ... <em>Description</em></summary>` 形式のどちらかにします。
- レッスン表は `| # | Lesson | Type | Lang |` の列構造を保ちます（capstone 表では `| # | Project | Combines | Lang |`）。`Lang` 列はプレーンテキスト（`Python, TypeScript`）でも従来の絵文字フラグ（`🐍 🟦 🦀 🟣 ⚛️`）でも構いません。パーサー上は同等です。
- ROADMAP のステータス絵文字（`✅`, `🚧`, `⬚`）は、フェーズ見出しとレッスン行で維持してください。テキストに置き換えないでください。パーサーは正確な文字をキーにしています。

これらのファイルを編集したら `node site/build.js` を実行してください。構造を壊していなければ、`git diff site/data.js` はタイムスタンプの変更だけになるはずです。

## 貢献方法

### 1. 新しいレッスンを追加する

各レッスンは `phases/XX-phase-name/NN-lesson-name/` に置き、次の構造にします:

```text
NN-lesson-name/
├── code/           At least one runnable implementation
├── notebook/       Jupyter notebook for experimentation (optional)
├── docs/
│   └── en.md       Lesson documentation (required)
└── outputs/        Prompts, skills, or agents this lesson produces (if applicable)
```

**レッスンドキュメント形式**（`en.md`）:

```markdown
# Lesson Title

> One-line motto — the core idea in one sentence.

## 問題

Why does this matter? What can't you do without this?

## The Concept

Explain with diagrams, visuals, and intuition. Code comes later.

## 実装

Step-by-step implementation from scratch.

## Use It

Now use a real framework or library to do the same thing.

## Ship It

The prompt, skill, agent, or tool this lesson produces.

## Exercises

1. Exercise one
2. Exercise two
3. Challenge exercise
```

### 2. 翻訳を追加する

任意のレッスンの `docs/` フォルダーに新しいファイルを作成します:

```text
docs/
├── en.md    (English — always required)
├── zh.md    (Chinese)
├── ja.md    (Japanese)
├── es.md    (Spanish)
├── hi.md    (Hindi)
└── ...
```

英語版と同じ構造を保ってください。コードではなく本文を翻訳します。

### 3. Output を追加する

レッスンが再利用可能なプロンプト、スキル、エージェント、MCP server を生成する場合:

1. レッスンの `outputs/` フォルダー内に作成する
2. トップレベルの `outputs/` index に参照を追加する

**プロンプト形式:**

```markdown
---
name: prompt-name
description: What this prompt does
phase: 14
lesson: 01
---

[System prompt or template here]
```

**スキル形式:**

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

### 4. バグ修正や既存レッスンの改善

- 実行できないコードを修正する
- 説明を改善する
- より良い図を追加する
- 古くなった情報を更新する

### 5. 演習やプロジェクトを追加する

演習やプロジェクトの追加は常に歓迎します。特に複数フェーズをつなぐものは有用です。

## ガイドライン

- **コードは動くこと。** すべてのコードファイルは、記載された依存関係でエラーなく実行できる必要があります。
- **コード内コメントなし。** コードは自明にし、説明は docs に書きます。
- **用途に合う最適な言語を使う。** TypeScript や Rust が適している場所に Python を無理に使わないでください。
- **最初にスクラッチ実装。** フレームワーク版を見せる前に、必ず第一原理から概念を実装します。
- **実用性を保つ。** 理論は実践に従います。その逆ではありません。
- **AI 量産文を入れない。** 人間が書いたように、直接的に、余計な語を削って書いてください。

## Pull Request の流れ

1. リポジトリをフォークする
2. feature branch を作成する（`git checkout -b add-lesson-phase3-gradient-descent`）
3. 変更する
4. すべてのコードが動くことを確認する
5. 明確な説明を添えて pull request を送る

## 行動規範

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を参照してください。親切に、有益に、建設的に振る舞ってください。

## スタイル

- 直接的な文章。余計な語を削る。マーケティングコピーではなく、このマニュアルのトーンに合わせる。
- 見出しに装飾絵文字を使わない。Lang 列の絵文字フラグだけは、パーサーが対応しているため例外です。
- コードは、レッスンに記載された依存関係でそのまま動くこと。
- 最初にスクラッチ実装、次にフレームワーク。
