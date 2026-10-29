---
name: lesson-screen
version: 1.0.0
description: >
  Opens a lesson screen in the browser next to the terminal while a course
  tutor teaches. It shows the lesson's registered figures, code traces with
  real values, and clickable predictions. It also builds a figure for the
  lesson on the fly with the course figure skills and any figure skill the
  host has installed: a blueprint, a mechanism, an isometric machine, or a 3D
  model. Clicks return to the tutor as events. Trigger phrases: "open the
  lesson screen", "show me this visually", "show this in 3D", "draw the
  architecture", "visualize this lesson", "build a figure for this lesson",
  "lesson screen".
tags: [tutor, visual, figures, 3d, blueprint, interactive-learning]
---

# Lesson screen

The lesson screen is a small local web server and one browser tab. The tutor keeps teaching in the terminal. At each step it writes one screen into a folder, and the browser shows the newest screen. The learner can press options and click parts. Those clicks go to an event log that the tutor reads before its next reply.

Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md. It needs Node.js 20 or later and a browser on the same machine. It installs no packages.

## When to use

- A course tutor teaches a lesson, and the learner accepts the screen. The tutors are learn, learn-mcp, learn-agent-skills, learn-reverse-engineering, claude-certification, and mcpa-certification.
- The learner asks to see a lesson, a concept, or a system: "show me", "draw it", "in 3D".
- A concept has a structure, a flow, or a number that changes. Seeing it helps more than reading it.

## When not to use

- The learner declined the screen. Do not offer it again this session.
- The learner cannot reach a browser page from the host: a chat app, or a remote machine without port forwarding. Give the lesson page on aiengineeringfromscratch.com. `references/hosts.md` lists the cases.
- The step is words only: a clarifying question, a tradeoff, or a definition. Keep it in the terminal and show the waiting screen.
- You need a permanent figure for a lesson file. Use the figure skills directly. This skill makes screens for one learner.

## Paths

`SKILL_ROOT` is the folder that holds this SKILL.md. In this file, `CLI` means `node "$SKILL_ROOT/scripts/lesson-screen.mjs"`.

Run every command from the learner's working folder. Screens go to `.lesson-screen/screens/`, and builds go to `.lesson-screen/builds/`. If the folder is a git repository, ask the learner to add `.lesson-screen/` to `.gitignore`.

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
| See it | the figure that you built for this lesson | the figure skills, the lesson text, and the real run |
| Prediction or quiz | the question and its options as buttons | `quiz.json`, without the answer |

`references/screens.md` lists every class, with a full example of each screen.

## Registered figures first

Most lessons already have interactive figures. Look for them before you build anything new.

1. Search the lesson's `docs/en.md` for fenced blocks with the language `figure`.
2. Put the first line of the fence in a host element: `<div class="lesson-figure" data-figure="kv-cache-sizer"></div>`.
3. Keep the JSON config of the fence if it has one, as in `data-figure='iso-machine {"machine":"kv-cache"}'`.
4. Change a config value only with a key that the fence already uses.

The screen loads the course figure runtime and mounts the figure. The figure looks and works as it does on the lesson page.

## Build a figure on the fly

The best figure for a lesson is one made for that lesson. Build it while you teach, so that it is ready at the See it step.

1. When the lesson starts, read `docs/en.md` and run the lesson code.
2. Name the lesson's system in one sentence: "X moves through Y, and that motion means Z."
3. Pick one form from the table below. Offer it with its time, and build only after the learner accepts.
4. Write a building screen and keep its stage list current.
5. Give the build to a second agent when the host can run one. Keep teaching in the terminal.
6. Without a second agent, build during the lab or the quiz, or offer the figure for the end of the session.
7. Check the build with `CLI shot`. Look at every image and fix what looks wrong.
8. Run `CLI publish <page.html>`. The page becomes the next screen.

| Form | Build it with | Time | Pick it when |
|---|---|---|---|
| Blueprint | the blueprint-figure skill | 5 to 10 minutes | the idea is a structure with named parts |
| Mechanism | tier 2 of the motion-figure skill | 15 to 25 minutes | one control changes a computed result |
| Isometric machine | the isometric-explainer skill | 40 to 90 minutes | the idea is a process with stations, order, and failures |
| 3D model | an installed figure skill with a 3D mode, or three.js | 60 to 120 minutes | depth or rotation is the idea, or the learner asks for 3D |

Offer the smallest form that shows the idea. Offer a larger form when the learner has time and asks for more.

`references/build.md` holds the build stages, the page contract, the craft rules, and the 3D rules. Read it before every build.

### Figure skills

The course figure skills are blueprint-figure, motion-figure, isometric-explainer, and course-style. If one is not installed, read its files from `https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/skills/<name>/`.

The host can have more figure skills installed, such as an isometric illustration skill with a 3D mode or WebGL effects. Check the host's skill list before you pick a form. Use such a skill when it fits the form, and keep the truth rules and the page contract of this skill.

## Practice after the lesson

`CLI practice <lesson-path>` writes a practice page for one lesson as the next screen. It has four parts:

- **Brief**: the hook, the learning objectives, and a card for each key term that shows its meaning on a press.
- **Drill**: the questions from `quiz.json`, with keys 1 to 4, Enter for the next question, and an optional timer.
- **Review**: missed questions return after 1, 3, 7, and 16 days.
- **Go deeper**: the lesson page, the lesson folder, the command that runs its code, one exercise, and further reading.

Follow these rules:

- Offer practice only after the tutor's own quiz for the lesson is complete. The page holds the answer key.
- The page grades itself and keeps its progress in the browser. Record nothing from it. It never changes a score, a review queue, or any evidence.
- It reads the lesson from the clone, or from GitHub when there is no clone.
- A lesson without `quiz.json` gets questions made from its Key Terms table.

## Truth rules

- Never invent a number. Readouts, labels, and step text come from the lesson text or a real run.
- A built figure with motion uses a small tested state model. The model moves the parts and writes the readouts.
- Never put a correct answer, an answer index, or an explanation on a screen before the learner answers. The learner can read the page source. The practice page is the one exception, and it appears only after the tutor's quiz.
- A click is a hint. It never counts as a quiz answer, checkpoint evidence, or a lab result.
- The tutor's own rules decide progress, scores, and evidence.
- Every built figure shows a line that says your tutor built it for this lesson and the course authors did not review it.
- Every simulated or scaled value says so on the page.

## Events

`CLI events` prints `{"type":"events","events":[...]}`. Each event has `type`, `screen`, and `at`, plus the fields below.

| type | Fields | Meaning |
|---|---|---|
| `choice` | `question`, `choice`, `text` | The learner pressed an option |
| `part` | `part`, `label` | The learner asked about a part of a built figure |
| `step` | `step`, `label` | The learner moved to a step of a built figure |
| `note` | `text` | A free note from a custom screen |

`CLI events --all` prints every event and keeps the read position.

## Stop and keep

- Run `CLI stop` when the lesson ends, unless the next lesson starts now.
- The server stops by itself after two idle hours.
- Built pages open from disk. Questions to the tutor work only through the server.
- Copy the builds that the learner wants to keep to `learning-artifacts/<phase>-<lesson>/`, with their source.

## Commands

| Command | Does |
|---|---|
| `start [--open] [--foreground] [--port N] [--host H] [--url-host H] [--assets live\|local] [--repo PATH] [--idle-minutes N]` | Starts the server, or reuses a running one |
| `status` | Prints `running`, `url`, `screens`, `latest`, `next`, and the unread event count |
| `events [--all]` | Prints new events |
| `publish FILE [--name SLUG]` | Copies a built page into the screens folder as the next screen |
| `practice LESSON [--repo PATH] [--name SLUG]` | Writes a practice page for a lesson path as the next screen |
| `shot TARGET [--width N] [--height N] [--theme light\|dark] [--wait MS] [--out FILE] [--chrome PATH]` | Takes a screenshot of a screen name or a page file with a local Chrome, Chromium, or Edge |
| `stop` | Stops the server |

Every command takes `--dir PATH` for another session folder. Every command prints one JSON line. Errors go to stderr as JSON, with exit code 1.

By default the screen loads the figure runtime from aiengineeringfromscratch.com. `--assets local` loads it from the `site/` folder of a clone. Run `node site/build.js` in that clone first.

## Check before you finish

- [ ] The learner got the full URL with its key, or the lesson page link.
- [ ] You read events before each reply.
- [ ] Each screen matches the step that you teach in the terminal.
- [ ] No screen holds an answer before the learner answers.
- [ ] Every number on a built figure comes from the lesson or a real run.
- [ ] You looked at `CLI shot` images of each build in both themes before you published it.
- [ ] You stopped the server, or told the learner that it stays up.
