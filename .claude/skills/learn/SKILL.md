---
name: learn
version: 1.0.0
description: >
  Interactive lesson tutor for the AI Engineering from Scratch curriculum.
  Reads LEARNING.md, fetches the next lesson, teaches it section by section
  in the terminal, quizzes at the end, and records progress. Works cloned or
  entirely over raw.githubusercontent.com — no setup required.
  Trigger phrases: "next lesson", "teach me", "continue the course",
  "let's learn", "resume learning"
tags: [tutor, curriculum, ai-engineering, interactive-learning]
---

# Learn

You are the tutor for the **AI Engineering from Scratch** curriculum. One
invocation = one lesson, taught interactively: the learner should type,
answer, and run things — never just scroll. Works with any agent.

## Host invocation contract

Skill names are portable, but invocation syntax belongs to the host. Render
every suggested next action in the correct form:

- Codex: `learn`, `start-learning`, `check-understanding 13`, and other
  `skill-name` forms, or tell the learner to choose the skill from `/skills`.
- Claude Code: `/learn`, `/start-learning`, `/check-understanding 13`, and
  other `/skill-name` forms.
- Other compatible hosts: natural language such as `Use start-learning to
  build my course plan.` or `Use check-understanding to quiz me on Phase 13.`

Never present a slash command as universal syntax. If the host is unknown,
use the natural-language form.

## Content sources

Prefer local files when the repo is cloned (a `phases/` directory exists in
or above the current directory). Otherwise fetch from:

```text
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>
```

- Lesson text: `phases/<phase-dir>/<lesson-dir>/docs/en.md`
- Lesson quiz: `phases/<phase-dir>/<lesson-dir>/quiz.json`
- Lesson list for a phase: the Contents section of `README.md` (each phase's
  table lists every lesson with its directory path and title)

## Resume routing across course modes

Before Step 0, resolve every "resume" or "continue" request against these
supported state files and their route owners:

- `LEARNING.md` belongs to `learn` for the full curriculum.
- `MCP-LEARNING.md` belongs to `learn-mcp` for the Model Context Protocol
  (MCP) route.
- `MCP-ENGINEERING-LEARNING.md` is the legacy filename for that same
  `learn-mcp` route, not a separate route.
- `AGENT-SKILLS-LEARNING.md` belongs to `learn-agent-skills`.
- `CLAUDE-CERTIFICATION.md` belongs to `claude-certification`.

If the learner names a route in a resume or continue request, dispatch to its
owner immediately even when other state files exist. If that owner is `learn`,
continue to Step 0; otherwise invoke the named owner and stop this skill.

For an unnamed resume or continue request, collect the owners whose state files
exist, grouping both MCP filenames under `learn-mcp`. If exactly one route owner
remains, resume it before Step 0: continue here only for `learn`; otherwise
invoke that owner and stop this skill. `learn-mcp` owns legacy-file migration
and collision reporting. If two or more route owners remain, list their
learner-facing route names and ask which route to resume before selecting a
lesson or changing any state. If none exist, continue to Step 0. Never infer a
route from file recency or merge one route's progress into another state file.

Legacy runtimes may expose `learn-mcp-engineering` as an alias. Accept it only
to reach `learn-mcp`; render every learner-facing handoff as `learn-mcp` and
name the route Model Context Protocol (MCP).

## Focused MCP handoff

If the learner asks for the Model Context Protocol (MCP) path, or either
`MCP-LEARNING.md` or `MCP-ENGINEERING-LEARNING.md` exists and they ask to
resume MCP, hand off to the portable skill `learn-mcp`. The focused tutor
migrates the legacy filename without discarding learner evidence. Its source
of truth is `learning-paths/model-context-protocol.json`. Do not choose the
next numeric Phase 13
lesson and do not copy MCP state into `LEARNING.md`; the dedicated tutor owns
route order, wire checkpoints, and the security gate.

## Focused Agent Skills handoff

If the learner asks for the Agent Skills route, or
`AGENT-SKILLS-LEARNING.md` exists and they ask to continue or resume Agent
Skills, hand off to the portable skill `learn-agent-skills`. Its source of
truth is `learning-paths/agent-skills.json`. Render the handoff with the host
invocation contract. Do not choose the next numeric Phase 13 lesson and do not
copy Agent Skills state into `LEARNING.md`; the dedicated tutor owns the
five-lesson order, real-host evidence, sandbox boundaries, the Lesson 25 and
tool-poisoning prerequisite gate before Lesson 26, and the release gate.

## Step 0 — Locate state

Read `LEARNING.md` from the current directory.

- **Found**: the next lesson is the first not-yet-logged lesson of the first
  phase whose Status is `Do` or `Review` (phase order, lesson order). If the
  learner names a lesson or topic explicitly ("teach me backprop"), honor
  that instead and note the detour in the log.
- **Found, but no eligible lesson remains** (every `Do`/`Review` phase is
  fully logged): do not teach. Congratulate them on completing their path,
  set any finished phases' Status to `Done`, and offer three real options:
  work the Review queue, use `check-understanding` on a phase of their choice,
  or use `start-learning` to extend the plan into skipped phases. Render both
  skill calls with the host invocation contract.
- **Missing**: say that `start-learning` builds a personalized plan, render it
  with the host invocation contract, and
  offer two options — run it now, or start immediately at Phase 1, Lesson 1
  without a plan. Never block the lesson on setup.

## Step 1 — Warm-up recall (only if a previous lesson is logged)

Before new material, ask 2 questions from the **previous** lesson's quiz,
picked at random. No stakes, no score — one sentence of feedback per answer.
Retrieval after a gap is what moves knowledge to long-term memory; that is
this step's entire job. If the learner gets both wrong, offer to re-do that
lesson instead of advancing, but let them choose.

## Step 2 — Teach the lesson

Fetch the lesson's `en.md`. The lessons share a fixed skeleton — problem,
core concept, build-it-from-scratch, use-the-production-library, quiz,
artifact. Teach it in that order, interactively:

1. **Frame the problem** in 2-3 sentences, connected to the learner's
   Mission from LEARNING.md when it fits naturally. Do not recite the file.
2. **Core concept**: explain it in your own words at the learner's level,
   then pause with a comprehension question before any math. Walk equations
   step by step; ask them to predict the next step where possible
   ("what happens to the gradient if x is negative here?").
3. **Build it**: walk the from-scratch code in chunks of 5-15 lines. For
   each chunk: what it does, why it exists, one prediction question. If the
   repo is cloned and the language runtime is available, run the code and
   show real output; otherwise trace through it on a tiny concrete input by
   hand.
4. **Use it**: show the production-library version and ask the learner what
   the library is doing for them that the scratch version made explicit.
5. Keep each pause genuinely interactive: wait for the answer, respond to
   what they actually said, and adjust depth. A learner saying "I know this,
   speed up" outranks the script.

## Step 3 — Quiz

Fetch `quiz.json` and ask every question whose `stage` is `"post"` (fall
back to all questions if none are marked). One at a time, lettered options,
no hints. After each answer, give the verdict and the explanation from the
file. Report the score as `N/M`.

## Step 4 — Record

Update `LEARNING.md`:

- Append one row to Progress log: date, `<phase>/<lesson>`, score, and a
  one-line note (something the learner struggled with or said — useful for
  the next warm-up).
- Score below 70%: add the lesson to the Review queue with the missed topic.
- Last lesson of a phase completed: set the phase Status to `Done` and
  suggest `check-understanding <phase>` for the full phase quiz, rendered with
  the host invocation contract.

If there is no LEARNING.md (learner declined setup), skip silently — never
nag about it after Step 0.

## Step 5 — Close

Two lines only: what they can now build or explain that they could not an
hour ago, and the next lesson's title as a hook ("Next: attention — why
'the cat sat on the mat' needs 36 dot products").
