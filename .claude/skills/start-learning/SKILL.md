---
name: start-learning
version: 1.0.0
description: >
  One-time onboarding for the AI Engineering from Scratch curriculum (511
  lessons, 20 phases). Interviews the learner, runs the placement quiz, and
  writes LEARNING.md, a persistent study plan the learn skill drives.
  Trigger phrases: "start learning", "set up the course", "begin the
  curriculum", "onboard me", "create my learning plan"
tags: [onboarding, curriculum, ai-engineering, learning-plan]
---

# Start Learning

You are onboarding a learner into the **AI Engineering from Scratch**
curriculum: 511 lessons across 20 phases, from linear algebra to autonomous
agents. Your job is to produce `LEARNING.md`, a single file in the current
directory that captures why they are learning, where they should start, and
what their path looks like. Every later `learn` session reads and updates
this file, so treat it as the learner's source of truth.

Works with any agent. If your environment has a structured question/option
tool, use it for every question; otherwise present lettered options as plain
text and wait for the reply.

## Host invocation contract

Skill names are portable, but invocation syntax belongs to the host. Before
showing a next command, use the correct form:

- Codex: `start-learning`, `learn`, `course-guide`, and other `skill-name`
  forms, or tell the learner to choose the skill from `/skills`.
- Claude Code: `/start-learning`, `/learn`, `/course-guide`, and other
  `/skill-name` forms.
- Other compatible hosts: natural language such as `Use learn to start my
  first lesson.`

Never present a Claude Code slash command as universal syntax. When the host is
unknown, use the natural-language form.

## Resume routing across course modes

Before generic onboarding, resolve every "resume" or "continue" request
against these supported state files and their route owners:

- `LEARNING.md` belongs to `learn` for the full curriculum.
- `MCP-LEARNING.md` belongs to `learn-mcp` for the Model Context Protocol
  (MCP) route.
- `MCP-ENGINEERING-LEARNING.md` is the legacy filename for that same
  `learn-mcp` route, not a separate route.
- `AGENT-SKILLS-LEARNING.md` belongs to `learn-agent-skills`.
- `CLAUDE-CERTIFICATION.md` belongs to `claude-certification`.

If the learner names a route in a resume or continue request, dispatch to its
owner immediately even when other state files exist, then stop this skill.

For an unnamed resume or continue request, collect the owners whose state files
exist, grouping both MCP filenames under `learn-mcp`. If exactly one route owner
remains, invoke it and stop this skill before generic onboarding. `learn-mcp`
owns legacy-file migration and collision reporting. If two or more route owners
remain, list their learner-facing route names and ask which route to resume
before running placement or changing any state. If none exist, continue with
generic onboarding. Never infer a route from file recency or merge one route's
progress into another state file.

Legacy runtimes may expose `learn-mcp-engineering` as an alias. Accept it only
to reach `learn-mcp`; render every learner-facing handoff as `learn-mcp` and
name the route Model Context Protocol (MCP).

## Focused MCP handoff

If the learner explicitly wants Model Context Protocol (MCP) rather than the
full course, do not run placement and do not create `LEARNING.md`. Route to
the portable skill `learn-mcp`, whose source is
`learning-paths/model-context-protocol.json` and whose state file is
`MCP-LEARNING.md`. Use `learn-mcp` in Codex,
`/learn-mcp` in Claude Code, or ask another compatible host to use
`learn-mcp`. The dedicated tutor owns lesson selection, wire
evidence, and the public-deployment security gate.

## Focused Agent Skills handoff

If the learner explicitly wants Agent Skills instead of the full course, or
`AGENT-SKILLS-LEARNING.md` exists and they ask to resume that route, do not run
placement and do not create `LEARNING.md`. Route to the portable skill
`learn-agent-skills`, whose source is `learning-paths/agent-skills.json` and
whose state file is `AGENT-SKILLS-LEARNING.md`. Use `learn-agent-skills` in
Codex, `/learn-agent-skills` in Claude Code, or ask another compatible host to
use `learn-agent-skills`. The dedicated tutor owns the five-lesson order,
real-host evidence, sandbox boundaries, the Lesson 25 and tool-poisoning
prerequisite gate before Lesson 26, and the release gate.

If `LEARNING.md` already exists, do not overwrite it. Summarize what it says
(mission, entry point, progress so far) and offer exactly three paths:

- **Resume**: invoke `learn` with the host syntax above; skip the interview and
  placement entirely.
- **Re-run placement**: administer the quiz again, then update only the
  Placement section and the Path statuses; keep the Mission, the Progress
  log, and the Review queue untouched.
- **Start over**: only after an explicit confirmation, rename the current
  file to `LEARNING-<YYYY-MM-DD>.md` as an archive, then proceed with the
  full onboarding below. Never delete or overwrite their history silently.

## Step 1: The interview (3 questions, keep it short)

1. **Why are you learning AI engineering?** Free text. Examples to offer:
   ship an AI product, career change, understand what I already use daily,
   research. Capture their answer in their own words because it grounds every
   future lesson explanation.
2. **How much time per week?** Options: ~2 h, ~5 h, ~10 h, "as fast as
   possible". Used only to phrase the pace honestly, never to cut content.
3. **What do you most want to build by the end?** One line. An agent, a
   trained model, a RAG product, "not sure yet" is fine.

Do not ask more than these three. The placement quiz measures knowledge;
the interview only captures intent.

## Step 2: Placement

Run the placement quiz from the `find-your-level` skill (it installs
alongside this one): 5 areas, 10 questions, mapped to an entry phase.

If the learner says they already know where they want to start ("just start
me at phase 7"), respect that and skip the quiz, with the same output
contract as a quiz run so the `learn` tutor always finds a well-formed plan:

- Validate the phase is 0-19 and resolve its canonical name; if it does not
  resolve, list the 20 phases and ask them to pick.
- In the Path table: phases below the entry point are `Skip`, the entry
  point and everything above are `Do` (no `Review` rows because there are no area
  scores to infer them from), and the Est. hours total is the sum of the
  `Do` rows.
- In the Placement section write `Score: self-selected` instead of a
  number.

## Step 3: Write LEARNING.md

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
- Entry point: Phase <N>: <name>
- Pace: ~<hours>/week

## Path
| Phase | Name | Status | Est. hours |
|-------|------|--------|------------|
<all 20 phases; Status is Skip, Review, Do, or Done from the placement
result. Hours come from ROADMAP.md: read it locally if the repo is cloned,
otherwise fetch
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/ROADMAP.md>

## Progress log
| Date | Lesson | Quiz | Note |
|------|--------|------|------|

## Review queue
<empty for now; learn adds lessons the quizzes flag>
```

## Step 4: Hand off

Close with three lines, nothing more:

- Their entry point and total estimated hours for the Review + Do phases.
- Give the host-correct invocation for `learn` and say that it starts the first
  lesson and picks up from this file every time.
- Give the host-correct invocation for `course-guide <topic>` and say that it
  can jump to a specific topic instead.
