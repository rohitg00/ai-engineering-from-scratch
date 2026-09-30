# Replay attempts into a visible schedule

> Derive due dates from stable, dated attempt events.

**Type:** Build  
**Language:** TypeScript  
**Stage:** 3 of 4  
**Time:** About 2 hours

## What you are building

Store attempts as events so progress can be recomputed. Each event has an ID, card ID, date and answer. Exact duplicate events should not advance a card twice. A reused ID with different contents is an error. Sort by date and then event ID to make same-day ordering deterministic.

```figure
pj-source-grounded-study-coach-3
```

## Work through an example

A first correct response on September 1 moves a card to box 1, due September 2. A correct response on September 2 moves it to box 2, due September 4. An incorrect response resets the box to 0 and schedules the next day. Boxes cap at 5, whose correct interval is 16 days.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `parseDay(value: string): number`
- `buildProgress(deck, attempts, initialDate): Progress[]`
- `dueCards(progress, date): Progress[]`

Accept only real YYYY-MM-DD dates; September 31 must fail. Attempts cannot precede initialDate or refer to unknown cards. Start every card at box 0 due on initialDate. Correct answers advance one box and use 2^(box-1) days; incorrect answers reset and use one day. Return progress in deck order; dueCards selects due <= date and sorts by due date then card ID.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Perform calendar arithmetic at UTC midnight to avoid local daylight-saving shifts. Deduplicate events before processing. Check an out-of-order input list against its sorted equivalent and a month-boundary date against an explicit expected date.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py source-grounded-study-coach --init my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --stage 3 --path my-source-grounded-study-coach
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Why might two same-day correct attempts overstate learning even though the scheduler is deterministic? Which scheduling policy would you change for real learners?

## Connect it to the finished artifact

A standalone answer-reveal practice page and progress.json with due cards and reproducible schedule state. The core uses authored questions and exact normalized answer matching. It does not judge arbitrary essays or infer understanding. The review intervals are a deterministic teaching policy, not an empirically validated learning-outcome claim. Source offsets use JavaScript UTF-16 code units.

After completing the project, try your own inputs:

```bash
cd my-source-grounded-study-coach
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output
```

Add a documented same-day advancement cap or an alternative scheduling policy. Compare behavior on the same attempt log instead of claiming better learning from interval length alone.

## Primary reference

[Official API documentation](https://nodejs.org/api/typescript.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
