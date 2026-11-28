# Workbench

A micro-learning app for the 542 lessons in this repository. It turns each
`docs/en.md` lesson into a short loop you can finish in one sitting: guess,
read one small section, look at the real code, try an exercise, answer the
quiz, then explain the idea back without looking.

Nothing is uploaded. Progress lives in `localStorage` in your browser.

```bash
cd web
node scripts/build-content.mjs   # repo -> public/content (16 MB, 542 lessons)
node scripts/serve.mjs           # http://localhost:5173
```

`npm run dev` does both. There is no `npm install`: see
[Why zero dependencies](#why-zero-dependencies).

## What it reads

The app is a view over the repository, not a copy of it.

| Source | Used for |
|---|---|
| `phases/*/*/docs/en.md` | Hook, objectives, problem, concept chunks, build/use/ship/verify sections, key terms, exercises |
| `phases/*/*/quiz.json` | Pre-test and post-test questions, with explanations |
| `phases/*/*/code/` | Up to five real source files per lesson, plus the run command |
| `phases/*/*/outputs/` | Artifact names listed on the build step |
| `ROADMAP.md` | Phase order, lesson minutes, status |
| `phases/*/README.md` | Phase summaries |

`scripts/build-content.mjs` writes one JSON file per lesson into
`public/content/lessons/`, plus a `catalog.json` with phase and lesson
metadata. Both are generated and gitignored; run the build after pulling.

## The learning loop

Every lesson becomes the same script, whatever its section layout:

1. **Lesson** — title, hook, objectives, and what the loop will ask of you.
2. **Before you read** — the `pre` questions. Guessing first makes the reading
   that follows stickier, even when the guess is wrong.
3. **The problem** — why the idea exists.
4. **Concept 1..n** — the concept section split into chunks of about 1300
   characters, so a step fits on one screen.
5. **Build it** — the real `code/` files, blurred until you predict what they
   print, plus the command that runs them.
6. **Practice** — the lesson's exercises as a checklist, with a note field.
7. **Check yourself** — the `check` and `post` questions, first try only.
8. **Recall** — write the idea in your own words, then compare against the
   lesson's key terms. Missing terms are the ones to reread.
9. **Done** — XP, quiz score, and the cards this lesson added.

Progress is per step. XP is granted once per step reached, so jumping back and
forth never farms the meter, and retaking a quiz never adds XP.

## Review

Finishing a lesson adds its key terms and quiz answers as flashcards. The
queue uses a small SM-2 variant in `src/lib/scheduler.js`: four grades
(again, hard, good, easy), an ease factor per card, and intervals that stretch
from ten minutes to a year. Space flips the card; `1`–`4` grade it.

This is deliberately simpler than FSRS. It needs no training data, no model
weights, and it behaves identically on every device.

## Routes

```text
#/                             today: continue, plan, phase rail
#/library                      all phases, search, filters
#/roadmap                      ROADMAP.md status merged with your progress
#/phase/<phase-id>             one phase, lessons in order
#/lesson/<phase-id>/<slug>     the player
#/review                       spaced repetition queue
#/progress                     XP, streak, heatmap, per-phase bars
```

## Files

```text
web/
  index.html                 shell, fonts, mount point
  src/main.js                hash router and boot
  src/shell.js               header, nav, footer
  src/styles.css             tokens, layout, components
  src/lib/dom.js             element helpers, icons, toast
  src/lib/store.js           localStorage state, XP, streak, cards
  src/lib/scheduler.js       SM-2 variant and interval previews
  src/lib/content.js         catalog/lesson loading, step script, cards
  src/lib/markdown.js        block and inline renderers
  src/lib/math-text.js       LaTeX subset -> readable plain math
  src/views/*.js             today, library, roadmap, phase, lesson, review, progress
  scripts/build-content.mjs  repository -> public/content
  scripts/serve.mjs          static server, no dependencies
  scripts/check.mjs          syntax + content shape checks
  scripts/smoke.mjs          end-to-end lesson walk over CDP
  scripts/shots.mjs          visual QA screenshots
```

## Verify

```bash
node scripts/check.mjs    # parse every source file, sample the content
node scripts/smoke.mjs    # drive a full lesson, fail on any page error
node scripts/shots.mjs    # screenshots of every route into .shots/
node scripts/shots.mjs --theme dark --size 420x900
```

`smoke.mjs` and `shots.mjs` drive a real Chromium browser over the DevTools
protocol, so they need a running server plus Edge or Chrome. Set `EDGE_PATH` if
the browser is not in a default location. Screenshots land in `.smoke/` and
`.shots/`, both gitignored.

## Why zero dependencies

The repository is stdlib-first, and `npm install` cannot run over a WSL UNC
path. Instead of fighting the toolchain, the app is plain ES modules, one
hand-written stylesheet, and four Node scripts. There is no build step, no
transpiler, and no `node_modules`. `index.html` loads `src/main.js` and the
browser does the rest.

## Design

The visual language comes from the course itself (`.claude/skills/course-style`):

- paper `#fafaf5` with a 16px dot grid, ink `#1a1a1a`, one accent, blueprint
  `#3553ff`;
- VT323 for display headings, Source Serif 4 for body, JetBrains Mono for
  labels and code;
- square corners, 1px rules, hard offset shadows, no gradients as decoration;
- a full dark token set on `[data-theme="dark"]`, toggled in the header and
  remembered in `localStorage`;
- motion is short and functional, and `prefers-reduced-motion` turns it off.

## Limits

- The lesson player does not execute lesson code. It shows the source and the
  command to run it from the repository root.
- Interactive figures live on the published page; the reader links out to
  `aiengineeringfromscratch.com/lesson?path=...` for those.
- One browser, one learner. There is no account, sync, or server. Export JSON
  from the Progress page if you want a copy.
- Questions without a `check`/`post` stage, and the 55 legacy array-shaped
  `quiz.json` files, are normalized at build time; the site schema is the
  target, not the source of truth.
