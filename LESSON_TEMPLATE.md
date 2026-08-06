# Lesson Template

Use this template when creating a new lesson. Copy the folder structure and fill in the content.

## Folder Structure

```
NN-lesson-name/
├── code/
│   ├── main.py            (primary implementation — always a code/ dir)
│   ├── main.ts            (TypeScript version, if applicable)
│   ├── main.rs            (Rust version, if applicable)
│   └── main.jl            (Julia version, if applicable)
├── docs/
│   └── en.md              (lesson documentation — 6-beat format)
├── quiz.json              (exactly 6 questions: 1 pre + 3 check + 2 post)
└── outputs/
    ├── prompt-*.md         (prompts produced by this lesson)
    ├── skill-*.md          (skills produced by this lesson)
    └── agent-*.md          (agent definitions produced by this lesson)
```

A lesson MUST have at minimum:
- `code/` with at least one source or config file (rule L005)
- `docs/en.md` with at least 200 bytes and an H1 header (rules L002-L004)
- `quiz.json` with exactly 6 questions in the canonical schema (rules L006-L009)

The `notebook/` directory is **not** part of the standard lesson. If a lesson
benefits from a Jupyter notebook, add one in `code/` beside the implementation
files, or reference an external Colab link in the "Further Reading" section.

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
Use ASCII diagrams, tables, or link to visuals in the web app.
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

## Quiz Format (quiz.json)

Every lesson must have a `quiz.json` with exactly 6 questions following the
canonical schema:

```json
{
  "questions": [
    {
      "stage": "pre",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    },
    {
      "stage": "check",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    },
    {
      "stage": "check",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    },
    {
      "stage": "check",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    },
    {
      "stage": "post",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    },
    {
      "stage": "post",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    }
  ]
}
```

Rules (enforced by `scripts/audit_lessons.py`):
- **L006**: `quiz.json` must be valid JSON with a non-empty `questions` array
- **L007**: Legacy keys (`q`, `choices`, `answer`) are rejected — use canonical keys only
- **L008**: Options must be 2–6 items
- **L009**: `correct` must be a valid index within the options array

## Code File Guidelines

- Code must run without errors
- Add a 4–6 line header comment citing the lesson path and any external spec/RFC
  referenced by the implementation
- Include 5+ unit tests in `code/tests/test_<slug>.py` (use the lesson slug to keep
  module names unique across phases), runnable via `python -m pytest` or
  `python -m unittest`.  Use `scripts/scaffold_tests.py` to generate a skeleton
  from your code's function signatures
- Use inline comments sparingly — let the code speak, but don't be dogmatic about
  "zero comments."  Some algorithms need a one-liner to orient the reader
- Use the language that fits best for the topic
- Include a `# requires: pkg1, pkg2` comment at the top if your entry file needs
  packages outside the Python stdlib (see `scripts/lesson_run.py`)
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

### Agents

```markdown
---
name: agent-name
description: What this agent does
phase: [phase number]
lesson: [lesson number]
---

[Agent definition]
```
