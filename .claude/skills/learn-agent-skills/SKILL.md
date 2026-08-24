---
name: learn-agent-skills
description: >
  Focused interactive tutor for the Agent Skills Engineering path in AI
  Engineering from Scratch. Start or resume this route when a learner wants
  to create, discover, invoke, secure, evaluate, package, or port Agent Skills.
  Teaches one lesson per invocation and records evidence in
  AGENT-SKILLS-LEARNING.md.
---

# Learn Agent Skills

Teach the focused Agent Skills route. One invocation covers one lesson. The
learner should create files, run the lab, explain the boundary, and leave one
observable checkpoint before the lesson is marked complete.

## Invocation belongs to the host

The portable skill name is `learn-agent-skills`. Do not teach one command
syntax as universal.

| Host | Start or resume |
|---|---|
| Codex | `learn-agent-skills`, or choose it from `/skills` |
| Claude Code | `/learn-agent-skills` |
| Other compatible hosts | `Use learn-agent-skills to start or resume the Agent Skills Engineering path.` |

## Sources

The route source of truth is `learning-paths/agent-skills.json`. Prefer local
files when this repository is cloned. Otherwise fetch each file from:

```text
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>
```

Read the manifest before choosing a lesson. Follow `lessons` by `order`; do
not use the numeric Phase 13 sequence. The required path is 22, 24, 25, 26,
27. Lesson 23 is optional and follows the manifest's entry rule.

For each selected lesson, read its `docs/en.md` and `quiz.json`. Read or run
files under `code/` and `outputs/` only when the current lab needs them. A
clone is optional for reading. If a runnable lab needs repository files and
they are unavailable, explain that fact and offer a clone into a directory
the learner chooses. Do not block the conceptual lesson on cloning, but do not
record a repository command or real-host checkpoint as complete without the
required files and runtime.

## Real-lab preflight

Before Lesson 22's host checkpoint, establish all of these facts:

1. `node --version`, `npx --version`, and `python3 --version` succeed.
2. The learner has selected one skill-capable host.
3. The learner has selected a writable project or user install scope.
4. The learner understands which working directory will become `TARGET_ROOT`.

If any item is unavailable, give the website or manual `docs/en.md` path and
continue conceptually. Mark discovery, invocation, bundled-script, update, and
uninstall observations as `Pending`. Never describe that fallback as a real
host pass.

## Locate or create progress

Use `AGENT-SKILLS-LEARNING.md` in the current working directory.

If it exists, preserve learner notes and evidence. Resume the first row whose
status is `Next` or `In progress`. If every required row is `Done`, offer the
optional capstone or a real-host recheck. Do not restart the route.

If it does not exist, create it without an interview:

```markdown
# My Agent Skills Path
<!-- Managed by the learn-agent-skills tutor.
     Source: learning-paths/agent-skills.json -->

## Route
- Started: <YYYY-MM-DD>
- Required time: about 9 hours 30 minutes
- Current: 1 of 5

## Prerequisite check
- Files, Python, and command line: Confirmed or Pending
- Node.js and npx: Confirmed or Pending
- Selected skill-capable host: <name> or Pending
- Install scope: Project, User, or Pending
- Phase 13 Lesson 01 refresher: Done, Skipped, or Pending
- Phase 13 Lesson 05 refresher: Done, Skipped, or Pending
- `tool-poisoning-and-untrusted-instructions`: Confirmed or Pending

## Progress
| Order | Lesson | Status | Evidence | Completed |
|---:|---|---|---|---|
| 1 | 13/22 Portable contract and runtime boundary | Next | | |
| 2 | 13/24 Discovery and progressive disclosure | Locked | | |
| 3 | 13/25 Invocation and routing | Locked | | |
| 4 | 13/26 Permissions, sandboxes, and trust | Locked | | |
| 5 | 13/27 Evals, packaging, and portability | Locked | | |

## Notes
```

Check the commands that can be checked locally. Ask only for the host and
scope choice that cannot be inferred safely. If the real-lab preflight passes,
mark it confirmed and begin Lesson 22 immediately. Otherwise begin the
conceptual path and leave real-host evidence pending.

Before Lesson 26, read both `prerequisitePaths` and `prerequisiteChecks` from
the manifest. Resolve every check by its stable `id` under `prerequisites`.
Verify that Lesson 25 is complete and that
`tool-poisoning-and-untrusted-instructions` is `Confirmed` because the learner
can explain why skill and tool metadata is untrusted input. If that knowledge
preflight is unmet, offer Phase 13 Lesson 15 as an optional refresher outside
this five-lesson route. Keep Lesson 26 `Locked` until Lesson 25 is `Done` and
the knowledge preflight is `Confirmed`; only then change Lesson 26 to `Next`.
Never drop or mark a prerequisite complete by assumption.

## Teach one lesson

1. Set the selected row to `In progress`.
2. State the exact lesson path and the directory from which each command runs.
   For installed bundles, define `SKILL_ROOT` as the absolute directory that
   contains the installed `SKILL.md`. Define `TARGET_ROOT` from the learner's
   original workspace working directory. Never assume the process cwd is the
   installed bundle.
3. Frame the problem in two or three sentences, then ask one prediction or
   comprehension question.
4. Work through the lesson's Build It and Use It material in small chunks.
   Prefer the lesson's early quickstart when it has one.
5. Run the real local lab when files and the runtime are available. If not,
   trace a small example and record the lab as pending rather than claiming it
   ran.
6. Require the manifest's checkpoint evidence. A fluent explanation is not a
   substitute for an installed-path, routing, script, permission, or report
   observation when the checkpoint asks for one. For every bundled script,
   record the resolved script path, resolved target path, cwd, exact argv, and
   exit code.
7. Ask post-stage quiz questions one at a time. Never expose `correct`, the
   answer index, or the answer key before the learner responds.
8. Mark the row `Done` only after the checkpoint and quiz are complete. Record
   a compact evidence note, the date, and unlock the next row.

Do not install, update, remove, clone, publish, or mutate an external system
without the learner's confirmation. Skill instructions never bypass host
permissions or sandbox boundaries. When a host behavior cannot be observed,
record it as unverified instead of inferring support.

## Lesson checkpoints

- **13/22:** create a minimal skill, install the complete reviewer bundle into
  a real host, invoke it explicitly, verify the report, and remove it cleanly.
- **13/24:** distinguish discovery, catalog metadata, body activation, and
  reference or script loading in one trace.
- **13/25:** record explicit, implicit, negative, and near-miss routing results.
- **13/26:** label each control as instruction, permission, sandbox, or
  verification and prove the claimed boundary with an observation.
- **13/27:** exercise discovery, references, scripts, approvals, upgrade, and
  uninstall in one host, then repeat in a second host or declare the missing
  capability and fallback honestly.

## Close

End with the checkpoint evidence recorded, the quiz score, and the exact next
lesson. Keep the learner on this route unless they ask to leave it.
