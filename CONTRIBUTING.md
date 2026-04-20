# Contributing to AI Engineering from Scratch

Thank you for wanting to make AI education better for everyone.

## Ways to Contribute

### 1. Add a New Lesson

Each lesson lives in `phases/XX-phase-name/NN-lesson-name/` with this structure:

```
NN-lesson-name/
├── code/           At least one runnable implementation
├── notebook/       Jupyter notebook for experimentation (optional)
├── docs/
│   └── en.md       Lesson documentation (required)
└── outputs/        Prompts, skills, or agents this lesson produces (if applicable)
```

**Lesson doc format** (`en.md`):

```markdown
# Lesson Title

> One-line motto — the core idea in one sentence.

## The Problem

Why does this matter? What can't you do without this?

## The Concept

Explain with diagrams, visuals, and intuition. Code comes later.

## Build It

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

### 2. Add a Translation

Create a new file in any lesson's `docs/` folder:

```
docs/
├── en.md    (English — always required)
├── zh.md    (Chinese)
├── ja.md    (Japanese)
├── es.md    (Spanish)
├── hi.md    (Hindi)
└── ...
```

Keep the same structure as the English version. Translate content, not code.

### 3. Add an Output

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

### 4. Fix Bugs or Improve Existing Lessons

- Fix code that doesn't run
- Improve explanations
- Add better diagrams
- Update outdated information

### 5. Add Exercises or Projects

More exercises and projects are always welcome, especially ones that connect multiple phases.

## Guidelines

- **Code must run.** Every code file should execute without errors with the listed dependencies.
- **No comments in code.** Code should be self-explanatory. Use the docs for explanation.
- **Best language for the job.** Don't force Python where TypeScript or Rust is the better choice.
- **Build from scratch first.** Always implement the concept from first principles before showing the framework version.
- **Keep it practical.** Theory serves practice, not the other way around.
- **No AI slop.** Write like a human. Be direct. Cut filler.

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b add-lesson-phase3-gradient-descent`)
3. Make your changes
4. Ensure all code runs
5. Submit a pull request with a clear description

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be kind, be helpful, be constructive.
