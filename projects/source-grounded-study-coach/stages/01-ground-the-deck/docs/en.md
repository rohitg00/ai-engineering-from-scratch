# Give every answer a source location

> Validate authored cards against immutable source passages.

**Type:** Build  
**Language:** TypeScript  
**Stage:** 1 of 4  
**Time:** About 2 hours

## What you are building

A practice card needs more than a question and answer. Store the source ID and start/end offsets for the supporting quote. A learner can then inspect why an answer is expected, and an editor can detect when a changed source invalidates a card. Validate before creating a practice queue.

```figure
pj-source-grounded-study-coach-1
```

## Work through an example

The source says Each packet records the harvest year. A card asking which year a packet records uses answer harvest year and evidence covering that sentence. If an editor changes the answer to purchase year while retaining the same source, validation rejects the card.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `validateDeck(value: unknown): Deck`

Require sources and cards arrays, unique nonempty IDs, source titles and nonempty text. Every card names a known source, a nonempty question and answer, and integer offsets satisfying 0 <= start < end <= text.length. The canonical answer must occur verbatim within that quote. Accepted variants are explicit nonempty strings. Return a detached copy so later edits to the input object cannot alter the validated deck.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use a source-ID map for lookup. Treat offsets as UTF-16 positions because JavaScript slice uses that unit. Include an emoji before a quote in a held-out example to expose accidental code-point indexing.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py source-grounded-study-coach --init my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --stage 1 --path my-source-grounded-study-coach
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Does an answer occurring in a passage prove that the question is well-written? Which parts need editorial review beyond these structural checks?

## Connect it to the finished artifact

A standalone answer-reveal practice page and progress.json with due cards and reproducible schedule state. The core uses authored questions and exact normalized answer matching. It does not judge arbitrary essays or infer understanding. The review intervals are a deterministic teaching policy, not an empirically validated learning-outcome claim. Source offsets use JavaScript UTF-16 code units.

After completing the project, try your own inputs:

```bash
cd my-source-grounded-study-coach
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output
```

Add a deck version or source digest and invalidate attempts only under an explicit migration policy. Do not silently remap evidence after source edits.

## Primary reference

[Official API documentation](https://nodejs.org/api/typescript.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
