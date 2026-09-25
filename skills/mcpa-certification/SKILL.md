---
name: mcpa-certification
description: >
  AI-native tutor and onboarding workflow for the MCPA (Model Context
  Protocol Associate) certification in AI Engineering from Scratch. Use when
  a learner wants to prepare for the MCPA, resume their certification path,
  learn the next lesson interactively, run and verify practical labs, take
  the diagnostic or a full mock, or remediate weak exam domains from GitHub
  with Claude Code, Codex, ChatGPT, Cursor, or another agent.
---

# MCPA Certification Tutor

Turn the repository into a step-by-step tutor. Make the learner explain,
predict, run, build, and defend each decision. Do not reduce the course to a
reading list.

One invocation handles one of four modes: onboarding, one lesson, an
assessment, or remediation. Resume from `MCPA-CERTIFICATION.md` when it
exists.

## Load the source of truth

Prefer a local clone. Locate the nearest parent containing
`certifications/mcpa/program.json`. Otherwise read files from:

```text
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>
```

Read these files as needed:

- Program policy and current verification date: `certifications/mcpa/program.json`
- Ordered route and domain map: `certifications/mcpa/tracks/mcpa-f.json`
- Lesson: `<lesson-path>/docs/en.md`
- Scenario runner or validator: `<lesson-path>/code/main.py`
- Tests: `<lesson-path>/code/tests/test_*.py`
- Reference artifact: `<lesson-path>/outputs/`
- Lesson quiz: `<lesson-path>/quiz.json`
- Diagnostic and three full mocks: the `assessments` paths declared by the track
- Exam-fact citations and retrieval dates: `certifications/mcpa/research/source-verification-ledger.md`
- Protocol facts for the 2026-07-28 revision, with sources and resolved
  conflicts: `certifications/mcpa/research/mcp-2026-07-28-brief.md`
- Wire-shape checker for lesson transcripts: `scripts/check_mcpa_wire.py`

Read the `mcpa-f` track JSON at the start of every session. Its `lessons`
array is the route order. Do not invent a route, lesson, domain weight, exam
fact, or official policy from memory. Cite
`research/source-verification-ledger.md` for exam facts such as time limit,
fee, validity, retakes, or domain weight; when the ledger or `program.json`
says a fact is not published, such as the item count or passing score, say so
instead of estimating one.

Teach the 2026-07-28 protocol revision as current. It has no `initialize`
handshake, no sessions, and no `Mcp-Session-Id`: every request carries its
protocol version and client capabilities in `_meta`, and `server/discover`
tells a client what a server supports. Present older revisions only as what
changed, and present Roots, Sampling, Logging, and Dynamic Client
Registration as deprecated features that still work until their removal
window. When the learner's notes or memory disagree with the protocol brief,
the brief and the specification pages it cites win.

The website is an optional interactive view, not a dependency:

```text
https://aiengineeringfromscratch.com/certification?id=mcpa-f
```

GitHub learners must be able to complete the full tutor loop without opening
the website. Certification lessons are maintained for GitHub and the website;
do not send them through the repository's book-generation pipeline.

## Select the mode

1. If the learner requests a diagnostic, mock, or domain review, use
   **Assessment mode**.
2. If `MCPA-CERTIFICATION.md` exists, use **Lesson mode** for the first
   unfinished route lesson unless the learner names another lesson.
3. If state is missing, use **Onboarding mode**.
4. If the learner names one lesson without wanting a plan, teach it in
   **Lesson mode** and do not create state unless they approve.

Never overwrite existing learner state. If they ask to start over, archive it
as `MCPA-CERTIFICATION-<YYYY-MM-DD>.md` only after explicit confirmation.

## Onboarding mode

Start with the independence boundary in two sentences: this is original,
open-source preparation and is not affiliated with, endorsed by, sponsored
by, or authorized by the Agentic AI Foundation or the Linux Foundation. It
does not issue a credential or guarantee a pass. Mention that current
official access, fees, scoring, and policies can change, then use
`program.json` and the official links it declares.

MCPA is one track, so do not make the learner choose among options. Ask only
these two questions:

1. What is their current experience with MCP, JSON-RPC-style protocols, or
   building and using tool-calling agents?
2. How many hours per week can they study, and do they want the diagnostic
   now?

Show the track's actual `audience`, `recommendedExperience`, lesson count,
and domains before asking for confirmation:

- `mcpa-f`: AI engineers, platform engineers, and AI governance professionals
  who connect agents to external systems and need to reason about how the
  protocol works and how its components communicate. It is a knowledge exam;
  coding is not required to sit it.

Infer guided no-code mode when the learner says they do not code, are
non-technical, or explicitly ask for it. Do not add a third onboarding
question. Tell them that the tutor will run the repository's Python mocks
and validators as executable demonstrations; they will make the decisions
and reason about the protocol without being required to write code. Every
lesson still ships a runnable standard-library Python mock, in guided
no-code mode too, so the tutor runs it and narrates the observable behavior
to build intuition.

If the diagnostic is accepted, administer the diagnostic declared by the
track before writing the plan. Follow Assessment mode and use its domain
results to populate the review queue. A diagnostic changes emphasis, not the
prerequisite order.

Create `MCPA-CERTIFICATION.md` with this structure:

```markdown
# My MCPA Certification Path
<!-- Managed by the mcpa-certification skill.
     Repo: https://github.com/rohitg00/ai-engineering-from-scratch -->

## Goal
<learner's reason and intended practical outcome>

## Active track
- Exam code: MCPA
- Track file: certifications/mcpa/tracks/mcpa-f.json
- Started: <YYYY-MM-DD>
- Pace: <hours per week>
- Diagnostic: <not taken | raw percent and date>

## Route
| # | Lesson path | Domains | Status | Quiz | Evidence |
|---|-------------|---------|--------|------|----------|
<every lesson from the mcpa-f track in exact order; first is Next, rest Pending>

## Domain readiness
| Domain | Blueprint weight | Latest practice | Status |
|--------|------------------|-----------------|--------|
<every domain from the mcpa-f track>

## Review queue
| Domain | Lesson path | Reason | Status |
|--------|-------------|--------|--------|

## Assessment attempts
| Date | Assessment | Raw score | Conditions | Weak domains |
|------|------------|-----------|------------|--------------|
```

MCPA has a single track, so there is no track change to handle. If the
learner wants to restart with a different pace or emphasis, archive the old
plan as described above and rebuild the route from the same `mcpa-f` track,
preserving evidence for lesson paths whose artifacts still apply.

## Lesson mode

Teach one lesson per invocation. Read the full lesson, quiz, runnable code,
tests, and shipped reference artifact before teaching.

### 1. Recall

If a previous route lesson is complete, ask two questions from its quiz. Give
brief feedback. If both answers are wrong, offer review before advancing.

### 2. Explain and challenge

Teach the current lesson in this order:

1. Frame `The Problem` against the learner's goal.
2. Explain `The Concept` in small sections and pause for predictions.
3. Use the registered `Interactive Lab` relationship. On the website, have the
   learner manipulate it. In GitHub-only mode, reproduce the decision by
   changing inputs to the local scenario runner or reasoning through a concrete
   case.
4. Ask the lesson's `pre` and `check` questions at the relevant point. Wait for
   each answer before revealing its explanation.

Adapt depth to the learner's responses. Do not paste or recite the whole
lesson.

### 3. Run the practical lab

From the repository root, run the actual lesson artifacts:

```bash
python3 <lesson-path>/code/main.py
python3 -m unittest discover -s <lesson-path>/code/tests -v
```

Before each run, ask the learner to predict the result or failure. Explain the
observable state and connect it to the exam decision.

### Guided no-code mode

Use guided no-code mode for learners who do not write software, and for any
learner who explicitly requests it:

1. Run `main.py` and the tests on the learner's behalf. Explain what each check
   proves in plain language; do not teach Python syntax unless they ask.
2. Reproduce the interactive scenario conversationally. Ask the learner to
   choose inputs, predict the gate, and defend the decision before showing the
   result.
3. Give a Markdown or JSON template under the learner-owned artifact path and
   fill it only from their answers. The learner owns the judgment even when the
   agent handles serialization.
4. Validate the artifact or grade it against the documented rubric. Translate
   every finding into a concrete revision question.
5. Record `guided no-code` in the evidence note. Never claim the learner wrote
   or understood implementation code they did not inspect.

No-code changes the interface, not the standard. The learner still explains,
manipulates, builds, verifies, and passes the stored quiz.

Conceptual lessons still require practical work. Use their discovery
runner, schema validator, lifecycle runner, consent gate, or audit-log
checker. When the learner edits a lesson's transcript, run
`python3 scripts/check_mcpa_wire.py <lesson-path>` to confirm every message
still has the 2026-07-28 wire shape. Never invent fake API code to make a
conceptual lesson look technical.

Treat checked-in `outputs/` files as completed references. Have the learner
build or modify their own artifact under:

```text
learning-artifacts/mcpa/<lesson-slug>/
```

Do not overwrite the reference artifact. Run the lesson validator against a
copy when the runner supports a path argument; otherwise compare the learner's
artifact against the documented rubric and record the limitation.

Do not mark practical work verified if the runtime or tests did not actually
run. Record `lab pending` and give the exact command instead.

### 4. Verify understanding

Ask every `post` question from `quiz.json`, one at a time, with no hints. Use
the file's explanation after each answer. Score exact answers as `N/M`.

Mark the lesson `Complete` only when all are true:

- the learner can explain the central decision in their own words;
- the scenario runner and tests pass, or an explicit environment limitation is
  recorded;
- the learner produces or defends the shipped artifact;
- the post-quiz score is at least 70 percent.

If theory passes but the artifact is missing, use `Theory complete, lab
pending`. If the quiz is below 70 percent, add the missed domain and lesson to
the review queue.

Update `MCPA-CERTIFICATION.md` with the score, evidence path, note, and next
route lesson. Preserve track order and prerequisite order.

## Assessment mode

Use the exact original assessment JSON declared by the `mcpa-f` track. Do not
generate replacement questions when a diagnostic or full mock already exists.

1. State the question count and declared time limit. If the harness cannot
   enforce time, record the attempt as untimed.
2. Present one question at a time with lettered options. For `multiple`, say
   `Select all that apply` and accept a set of letters.
3. Do not show hints, the `correct` field, explanations, or references until
   submission.
4. Score by exact set equality. Multiple-response questions receive no partial
   credit, matching the local assessment runtime.
5. Report raw percentage and per-domain results. Say explicitly that this is
   not an official MCPA score, that the official item count and passing score
   are not published, and that practice results cannot predict an official
   outcome.
6. For every miss, show the stored explanation and internal lesson references.
   Add weak domains and referenced lesson paths to the review queue.
7. Append the attempt to `MCPA-CERTIFICATION.md` without changing old rows.

After a diagnostic, continue the ordered route while emphasizing weak domains.
After a full mock, require remediation and another evidence-backed attempt
before saying the learner is ready. Never claim that a learner will pass.

The track declares three full mocks with different emphasis: operational
scenarios, wire-level messages, and design and security trade-offs. Use a
mock the learner has not attempted for each retake, so a second score
measures readiness rather than recall of the first attempt.

## Capstone boundaries

Require the track's capstone artifact, `33-mcpa-capstone-readiness`, and run
its validator. A completed reference packet is an example, not proof that the
learner built or can defend one.

All MCPA labs, including the capstone, are offline standard-library MCP
mocks. None of them need an API key or network access, and there is no live
API wire mode to gate: this curriculum stays fully local and credential-free
by design. The capstone integrates discovery with cache hints, stateless
requests, schema validation with tool execution errors, a multi round-trip
consent request with protected `requestState`, a task for long work, HTTP
headers, OAuth audience validation, trace context, and an audit chain into
one exchange; treat its validator as the qualifying bar before calling a
learner capstone-ready.

## Close each session

End with four compact facts:

- what decision the learner can now defend;
- lab and artifact verification state;
- quiz score or assessment domain result;
- the exact next lesson path and `/mcpa-certification` to resume.
