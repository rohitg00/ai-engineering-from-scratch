# Make the reading useful as a practice page

> Export a portable reveal-and-review view with reproducible progress.

**Type:** Build  
**Language:** TypeScript  
**Stage:** 4 of 4  
**Time:** About 2 hours

## What you are building

The finished page lets you type an answer, then reveal the expected answer and supporting quote. It also shows when each card is due. After revealing the source, the learner checks and records the actual typed answer locally. The page shows the next due date and downloads prior plus new attempts as JSON for the CLI. Re-recording a card edits its current session attempt, and reloading before download discards it. The page makes no network requests.

```figure
pj-source-grounded-study-coach-4
```

## Work through an example

The authored seed-library deck contains three cards. After two correct storage answers and one incorrect harvest-year answer, the September 3 report lists the untouched sorting card and the harvest-year card as due. The storage card is due September 4. Exporting the same events reproduces these dates.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `renderPractice(deck, progress, date): string`
- `exportPractice(deck, attempts, initialDate, date, out)`
- `proposeCard(source, endpoint, model, apiKey="")`

Write progress.json and index.html. Reject a report date before the initial date or before any attempt. Escape questions, answers, source titles and quotes. Include the exact-grading and teaching-scheduler methods. The optional real HTTP proposal adapter must require nonempty question, answer and verbatim quote; answer occurs inside quote and quote inside source. Save model proposals separately for author review.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use native details/summary for answer reveal so the page works without a framework or server. Test an HTML-like source title. For the adapter, run a local HTTP server that inspects the outgoing request and returns both valid and fabricated evidence.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py source-grounded-study-coach --init my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --stage 4 --path my-source-grounded-study-coach
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What can a learner do offline with only index.html? What must they retain to recompute progress or move to another interface?

## Connect it to the finished artifact

A standalone answer-reveal practice page and progress.json with due cards and reproducible schedule state. The core uses authored questions and exact normalized answer matching. It does not judge arbitrary essays or infer understanding. The review intervals are a deterministic teaching policy, not an empirically validated learning-outcome claim. Source offsets use JavaScript UTF-16 code units.

After completing the project, try your own inputs:

```bash
cd my-source-grounded-study-coach
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output
```

Use the Download attempts JSON button, then pass that file to --attempts with the selected review date as --date. Add a separate held-out evaluation of generated questions; a working transport and browser event export do not establish question quality.

## Primary reference

[Official API documentation](https://nodejs.org/api/typescript.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
