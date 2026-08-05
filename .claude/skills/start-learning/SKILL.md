---
name: start-learning
version: 1.0.0
description: >
  One-time onboarding for the AI Engineering from Scratch curriculum (503
  lessons, 20 phases). Interviews the learner, runs the placement quiz, and
  writes LEARNING.md — a persistent study plan the /learn skill drives.
  Trigger phrases: "start learning", "set up the course", "begin the
  curriculum", "onboard me", "create my learning plan"
tags: [onboarding, curriculum, ai-engineering, learning-plan]
---

# Start Learning

You are onboarding a learner into the **AI Engineering from Scratch**
curriculum: 503 lessons across 20 phases, from linear algebra to autonomous
agents. Your job is to produce `LEARNING.md` — a single file in the current
directory that captures why they are learning, where they should start, and
what their path looks like. Every later `/learn` session reads and updates
this file, so treat it as the learner's source of truth.

Works with any agent. If your environment has a structured question/option
tool, use it for every question; otherwise present lettered options as plain
text and wait for the reply.

If `LEARNING.md` already exists, do not overwrite it. Summarize what it says
(mission, entry point, progress so far) and offer exactly three paths:

- **Resume** — run `/learn`; skip the interview and placement entirely.
- **Re-run placement** — administer the quiz again, then update only the
  Placement section and the Path statuses; keep the Mission, the Progress
  log, and the Review queue untouched.
- **Start over** — only after an explicit confirmation, rename the current
  file to `LEARNING-<YYYY-MM-DD>.md` as an archive, then proceed with the
  full onboarding below. Never delete or overwrite their history silently.

## Step 1 — The interview (3 questions, keep it short)

1. **Why are you learning AI engineering?** Free text. Examples to offer:
   ship an AI product, career change, understand what I already use daily,
   research. Capture their answer in their own words — it grounds every
   future lesson explanation.
2. **How much time per week?** Options: ~2 h, ~5 h, ~10 h, "as fast as
   possible". Used only to phrase the pace honestly, never to cut content.
3. **What do you most want to build by the end?** One line. An agent, a
   trained model, a RAG product, "not sure yet" is fine.

Do not ask more than these three. The placement quiz measures knowledge;
the interview only captures intent.

## Step 2 — Placement

Run the placement quiz from the `find-your-level` skill (it installs
alongside this one): 5 areas, 10 questions, mapped to an entry phase.

If the learner says they already know where they want to start ("just start
me at phase 7"), respect that and skip the quiz, with the same output
contract as a quiz run so `/learn` always finds a well-formed plan:

- Validate the phase is 0-19 and resolve its canonical name; if it does not
  resolve, list the 20 phases and ask them to pick.
- In the Path table: phases below the entry point are `Skip`, the entry
  point and everything above are `Do` (no `Review` rows — there are no area
  scores to infer them from), and the Est. hours total is the sum of the
  `Do` rows.
- In the Placement section write `Score: self-selected` instead of a
  number.

## Step 3 — Write LEARNING.md

Create `LEARNING.md` in the current directory with exactly these sections:

```markdown
# My AI Engineering Path
<!-- Managed by the ai-engineering-from-scratch learning skills.
     Repo: https://github.com/rohitg00/ai-engineering-from-scratch -->

## Mission
<their answer to question 1, in their words, plus the build goal from question 3>

## Placement
- Date: <YYYY-MM-DD>
- Score: <total>/10 with the area breakdown, or exactly `self-selected` when the quiz was skipped
- Entry point: Phase <N> — <name>
- Pace: ~<hours>/week

## Path
| Phase | Name | Status | Est. hours |
|-------|------|--------|------------|
<all 20 phases; Status is Skip, Review, Do, or Done — from the placement
result. Hours come from ROADMAP.md: read it locally if the repo is cloned,
otherwise fetch
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/ROADMAP.md>

## Progress log
| Date | Lesson | Quiz | Note |
|------|--------|------|------|

## Review queue
<empty for now — /learn adds lessons the quizzes flag>
```

## Step 4 — Hand off

Close with three lines, nothing more:

- Their entry point and total estimated hours for the Review + Do phases.
- "Run `/learn` to start your first lesson — it picks up from this file
  every time."
- "Run `/course-guide <topic>` any time you want to jump to a specific
  topic instead."
