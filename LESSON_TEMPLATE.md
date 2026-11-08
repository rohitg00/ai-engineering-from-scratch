# Lesson Template

Use this template when creating a new lesson. Copy the folder structure and fill in the content.

## Folder Structure

| Path | What it holds |
|---|---|
| `code/main.py` | primary implementation |
| `code/main.ts` | TypeScript version, if applicable |
| `code/main.rs` | Rust version, if applicable |
| `code/main.jl` | Julia version, if applicable |
| `code/tests/` | 5 or more tests |
| `notebook/lesson.ipynb` | Jupyter notebook for experimentation |
| `docs/en.md` | lesson documentation |
| `quiz.json` | 6 questions: 1 pre, 3 check, 2 post |
| `outputs/prompt-*.md` | prompts produced by this lesson |
| `outputs/skill-*.md` | skills produced by this lesson |

## Documentation Format (docs/en.md)

```markdown
# [Lesson Title]

> [One-line motto — the core idea that sticks]

**Type:** Build | Learn
**Languages:** Python, TypeScript, Rust, Julia (list what's used)
**Prerequisites:** [List prior lessons needed]
**Time:** ~[estimated time] minutes

## The Problem

[2-3 paragraphs. What can't you do without this? Why should you care?
Make it concrete — show a scenario where not knowing this hurts.]

## The Concept

[Explain with diagrams and intuition. No code yet.
Use Mermaid or SVG diagrams, tables, or a registered `figure` fence. No ASCII diagrams.
Build mental models before implementation.]

## Build It

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

## Further Reading

- [Resource 1](url) — [why it's worth reading]
- [Resource 2](url) — [why it's worth reading]
```

## Code File Guidelines

- Code must run without errors
- No comments — code should be self-explanatory
- Use the language that fits best for the topic
- Include a `requirements.txt` or equivalent if there are dependencies
- Start simple, build up complexity
- Every function and class should have a clear purpose

## Output File Format

### Prompts

```markdown
---
name: prompt-name
description: What this prompt does
phase: [phase number]
lesson: [lesson number]
---

[Prompt content]
```

### Skills

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
