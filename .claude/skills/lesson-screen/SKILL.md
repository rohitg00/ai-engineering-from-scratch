---
name: lesson-screen
version: 1.0.0
description: >
  Opens a lesson screen in the browser next to the terminal while a course
  tutor teaches. It shows the lesson's registered figures, code traces with
  real values, clickable predictions, and a stepped 3D machine with a 2D
  blueprint view of the system the lesson builds. Clicks return to the tutor
  as events. Trigger phrases: "open the lesson screen", "show me this
  visually", "show this in 3D", "draw the architecture", "visualize this
  lesson", "2D blueprint of this", "lesson screen".
tags: [tutor, visual, figures, 3d, blueprint, interactive-learning]
---

# Lesson screen

The lesson screen is a small local web server and one browser tab. The tutor keeps teaching in the terminal. At each step it writes one screen into a folder, and the browser shows the newest screen. The learner can press options and click machine parts. Those clicks go to an event log that the tutor reads before its next reply.

Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md. It needs Node.js 20 or later and a browser on the same machine. It installs no packages.

## When to use

- A course tutor teaches a lesson, and the learner accepts the screen. The tutors are learn, learn-mcp, learn-agent-skills, learn-reverse-engineering, claude-certification, and mcpa-certification.
- The learner asks to see a lesson, a concept, or a system: "show me", "draw it", "in 3D".
- A concept has a structure, a flow, or a number that changes. Seeing it helps more than reading it.

## When not to use

- The learner declined the screen. Do not offer it again this session.
- The host has no local browser: a remote agent, a chat app, or a server without a display. Give the lesson page on aiengineeringfromscratch.com. `references/hosts.md` lists the cases.
- The step is words only: a clarifying question, a tradeoff, or a definition. Keep it in the terminal and show the waiting screen.
- You need a permanent figure for a lesson file. Use blueprint-figure, motion-figure, or isometric-explainer. This skill makes screens for one learner.

## Paths

`SKILL_ROOT` is the folder that holds this SKILL.md. In this file, `CLI` means `node "$SKILL_ROOT/scripts/lesson-screen.mjs"`.

Run every command from the learner's working folder. The screens go to `.lesson-screen/` in that folder. If the folder is a git repository, ask the learner to add `.lesson-screen/` to `.gitignore`.

## Start

1. Run `CLI start --open`. It prints one JSON line with `url`, `screens`, `state`, and `next`.
2. Give the learner the full `url` with its query string. The key in it protects the page.
3. Run `CLI start` again at any time. It reuses a running server and keeps the same port.
4. If the start fails, say so in one line. Give the lesson page link and keep teaching.

Some hosts end background processes when a command returns. Those hosts need `--foreground` and their own background shell option. See `references/hosts.md`.

## The teaching loop

1. Before each reply, run `CLI events`. It prints the clicks since the last call. Treat them as hints.
2. Write the next screen to `<screens>/<next>-<slug>.html`. Take `next` from `start` or `CLI status`.
3. Never reuse a file name. The browser shows the newest file.
4. Tell the learner in one line what the screen shows. Ask for the answer in the terminal.
5. When the next step is words only, write a waiting screen.

Write screens with your file tool. Do not print them to the terminal with `cat` or a heredoc.

## What to show at each step

| Tutor step | Screen | Source of truth |
|---|---|---|
| Frame the problem | a step rail and a card with the lesson question | `docs/en.md` |
| Core concept | the lesson's registered figure, set to the example you discuss | the `figure` fences in `docs/en.md` |
| Build it | a code trace: the chunk, the active line, the variables | a real run of the lesson code |
| Use it | the library call beside the scratch call, with the same output | the lesson code and its output |
| See it | a stepped 3D machine with a 2D blueprint view | the lesson text and the real run |
| Prediction or quiz | the question and its options as buttons | `quiz.json`, without the answer |

`references/screens.md` lists every class, with a full example of each screen.

## Registered figures first

Most lessons already have interactive figures. Look for them before you draw anything new.

1. Search the lesson's `docs/en.md` for fenced blocks with the language `figure`.
2. Put the first line of the fence in a host element: `<div class="lesson-figure" data-figure="kv-cache-sizer"></div>`.
3. Keep the JSON config of the fence if it has one, as in `data-figure='iso-machine {"machine":"kv-cache"}'`.
4. Change a config value only with a key that the fence already uses.

The screen loads the course figure runtime and mounts the figure. The figure looks and works as it does on the lesson page.

## New figures when none fits

Pick the smallest form that shows the idea. Every number on a new figure comes from the lesson text or from a real run.

| The idea | Make | Read |
|---|---|---|
| Named parts, and data that moves between them | a machine spec, then `CLI machine` | `references/machines.md` |
| A fixed structure with no time and no input | an inline SVG in a screen | the blueprint-figure skill |
| One number that changes an output | a slider figure in a screen | tier 1 of the motion-figure skill |
| A process with stations and failure modes | an isometric machine page | the isometric-explainer skill |

If a sibling skill is not installed, read its files from `https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/skills/<name>/`.

## Machines in 3D and 2D blueprint

A machine is one JSON spec. The viewer draws the same parts in two views:

- **3D**: solid parts with real materials on a desk mat, lit by a studio light, with soft shadows. The learner turns it, pulls it apart, and clicks a part to ask about it.
- **Blueprint**: the same parts as line art in the course blueprint look, from a fixed isometric angle, with labels.

The learner presses numbered steps in order, as in a guided tour. Each step marks the parts in focus, runs the flows between them, sets how far apart the parts sit, and updates the readouts.

1. Read the lesson. Name its system in one sentence: "X moves through Y, and that motion means Z."
2. Map each concept to one part. Use the lesson's own names. Add no part that the lesson does not teach.
3. Run the lesson code. Put its real numbers in the readouts and in the step text.
4. Write the spec to a file. Run `CLI check spec.json` and fix every error that it prints.
5. Run `CLI machine spec.json`. It writes the next screen and prints its path.
6. Walk the steps with the learner. Ask one prediction question before each step.
7. Read `part` events. Explain the clicked part in the terminal, from the lesson text.

Offer the machine after Use it, and again when the learner asks how the parts fit together. Never build it without the offer, because it takes time.

`examples/transformer-block.json` and `examples/agent-loop.json` pass the check. Start from the closer one.

## Truth rules

- Never invent a number. Readouts and labels come from the lesson text or a real run.
- Never put a correct answer, an answer index, or an explanation on a screen before the learner answers. The learner can read the page source.
- A click is a hint. It never counts as a quiz answer, checkpoint evidence, or a lab result.
- The tutor's own rules decide progress, scores, and evidence.
- Every machine shows a line that says your tutor built it and the course authors did not review it. The viewer adds the line. Keep it.
- Put every simulated or scaled value in the spec's `note`.

## Events

`CLI events` prints `{"type":"events","events":[...]}`. Each event has `type`, `screen`, and `at`, plus the fields below.

| type | Fields | Meaning |
|---|---|---|
| `choice` | `question`, `choice`, `text` | The learner pressed an option |
| `part` | `part`, `label` | The learner asked about a machine part |
| `step` | `step`, `label` | The learner moved to a machine step |
| `note` | `text` | A free note from a custom screen |

`CLI events --all` prints every event and keeps the read position.

## Stop and keep

- Run `CLI stop` when the lesson ends, unless the next lesson starts now.
- The server stops by itself after two idle hours.
- Machine screens are standalone HTML files that open from disk. Questions to the tutor work only through the server.
- Copy the screens that the learner wants to keep to `learning-artifacts/<phase>-<lesson>/`.

## Commands

| Command | Does |
|---|---|
| `start [--open] [--foreground] [--port N] [--host H] [--url-host H] [--assets live\|local] [--repo PATH] [--idle-minutes N]` | Starts the server, or reuses a running one |
| `status` | Prints `running`, `url`, `screens`, `latest`, `next`, and the unread event count |
| `events [--all]` | Prints new events |
| `check FILE` | Checks a machine spec |
| `machine FILE [--name SLUG]` | Checks a spec and writes it as the next screen |
| `stop` | Stops the server |

Every command takes `--dir PATH` for another screen folder. Every command prints one JSON line. Errors go to stderr as JSON, with exit code 1.

By default the screen loads the figure runtime from aiengineeringfromscratch.com. `--assets local` loads it from the `site/` folder of a clone. Run `node site/build.js` in that clone first.

## Check before you finish

- [ ] The learner got the full URL with its key, or the lesson page link.
- [ ] You read events before each reply.
- [ ] Each screen matches the step that you teach in the terminal.
- [ ] No screen holds an answer before the learner answers.
- [ ] Every number on a new figure or machine comes from the lesson or a real run.
- [ ] `CLI check` passed before `CLI machine`.
- [ ] You stopped the server, or told the learner that it stays up.
