# Source-Grounded Study Coach

Build practice questions with source evidence and a visible review schedule.

You build a standalone answer-reveal practice page and progress.json with due cards and reproducible schedule state. Inputs: A JSON deck with source passages, authored questions, accepted answers and evidence offsets, plus dated attempt events.

## Before you start

Node.js 22.18 or newer. The required core uses standard libraries and runs offline. TypeScript uses one set of explicit data types for deck validation, event processing and a portable HTML practice view.

- Write TypeScript functions, arrays and object types.
- Read JSON from local files and handle thrown errors.
- Understand that matching an answer string does not establish semantic understanding.

## Build it

```bash
python3 scripts/project_test.py source-grounded-study-coach --init my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --stage 1 --path my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --all --solution --strict
```

The first command creates an intentionally incomplete workspace. Later stages extend the same source file; their tests include new held-out inputs. Reference-solution passes verify the examples and do not earn a learner certificate.

## Use it

```bash
cd projects/source-grounded-study-coach/solution
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output
```

Open the resulting index.html locally. Type an answer, reveal its evidence, and select Check and record my answer. Download attempts JSON to retain the actual typed response together with prior events. Re-recording a card updates one new attempt in that page session; reloading before download discards it. The browser shows the next due date immediately using the same deterministic policy.

Rerun the scheduler with the downloaded file:

```bash
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./next-study-output
```

Use the review date selected in the page for --date. All browser processing stays local. Copy the HTML and JSON into your own workflow, or import the named functions from main. The included demo runs the same implementation on original fixtures:

```bash
node --experimental-strip-types demo.ts
```

## Stages

1. [Give every answer a source location](stages/01-ground-the-deck/docs/en.md)
2. [Return feedback that shows its source](stages/02-grade-with-evidence/docs/en.md)
3. [Replay attempts into a visible schedule](stages/03-schedule-review/docs/en.md)
4. [Make the reading useful as a practice page](stages/04-export-practice/docs/en.md)

## What the result establishes

The core uses authored questions and exact normalized answer matching. It does not judge arbitrary essays or infer understanding. The review intervals are a deterministic teaching policy, not an empirically validated learning-outcome claim. Source offsets use JavaScript UTF-16 code units.

Optional: append --provider-url http://127.0.0.1:1234/v1/chat/completions --model YOUR_MODEL. STUDY_MODEL_API_KEY supplies authentication if needed. The endpoint receives the first source passage and must return a verbatim quote and answer. The proposal is written separately to card-proposal.json for review and is never silently added to the deck.

Provider tests use controlled responses or loopback HTTP. They verify request and response contracts, not a model's quality or live service availability. No account connection, outgoing message, recurring task or cloud deployment is configured by this project.

## Make it your own

Replace the authored fixtures with a small export from your workflow and write down the expected result before running it. Preserve a second set of examples for evaluation. A useful before-and-after demonstration should show the input, inspectable intermediate evidence and portable output; it should not substitute a popularity claim for a measured result.

## Primary reference

[Official API documentation](https://nodejs.org/api/typescript.html). All project code, lesson prose and fixtures are original.
