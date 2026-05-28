# レッスンテンプレート

新しいレッスンを作成するときは、このテンプレートを使ってください。フォルダ構造をコピーし、内容を埋めます。

## フォルダ構造

```
NN-lesson-name/
├── code/
│   ├── main.py            (primary implementation)
│   ├── main.ts            (TypeScript version, if applicable)
│   ├── main.rs            (Rust version, if applicable)
│   └── main.jl            (Julia version, if applicable)
├── notebook/
│   └── lesson.ipynb       (Jupyter notebook for experimentation)
├── docs/
│   └── en.md              (lesson documentation)
└── outputs/
    ├── prompt-*.md         (prompts produced by this lesson)
    └── skill-*.md          (skills produced by this lesson)
```

## ドキュメント形式（docs/en.md）

```markdown
# [Lesson Title]

> [One-line motto — the core idea that sticks]

**種別:** 構築 | Learn
**言語:** Python, TypeScript, Rust, Julia (list what's used)
**前提条件:** [List prior lessons needed]
**所要時間:** ~[estimated time] minutes

## 問題

[2-3 paragraphs. What can't you do without this? Why should you care?
Make it concrete — show a scenario where not knowing this hurts.]

## The Concept

[Explain with diagrams and intuition. No code yet.
Use ASCII diagrams, tables, or link to visuals in the web app.
Build mental models before implementation.]

## 実装

[Step-by-step implementation from scratch.
Start with the simplest version, then add complexity.
Every code block should be runnable on its own.]

### Step 1: [Name]

[Explanation]

    [code block]

### Step 2: [Name]

[Explanation]

    [code block]

[...continue...]

## Use It

[Now show how frameworks/libraries do the same thing.
Compare your from-scratch version to the library version.
This proves the concept and introduces practical tools.]

## Ship It

[What reusable artifact does this lesson produce?
Could be a prompt, a skill, an agent, an MCP server, or a tool.
Include it here and save it in the outputs/ folder.]

## Exercises

1. [Easy — reinforce the core concept]
2. [Medium — apply it to a different problem]
3. [Hard — extend or combine with prior lessons]

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| [term] | [common misconception] | [actual definition] |

## 参考文献

- [Resource 1](url) — [why it's worth reading]
- [Resource 2](url) — [why it's worth reading]
```

## コードファイルのガイドライン

- コードはエラーなく実行できること
- コメントは入れない。コード自体で意図が伝わるようにすること
- トピックに最も合う言語を使うこと
- 依存関係がある場合は `requirements.txt` または同等のファイルを含めること
- 単純な形から始め、段階的に複雑さを加えること
- すべての関数とクラスに明確な目的を持たせること

## 出力ファイルの形式

### プロンプト

```markdown
---
name: prompt-name
description: What this prompt does
phase: [phase number]
lesson: [lesson number]
---

[Prompt content]
```

### スキル

```markdown
---
name: skill-name
description: What this skill teaches
version: 1.0.0
phase: [phase number]
lesson: [lesson number]
tags: [relevant, tags]
---

[Skill content]
```
