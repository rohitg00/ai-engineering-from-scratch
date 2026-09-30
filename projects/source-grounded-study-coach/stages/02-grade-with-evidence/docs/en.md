# Return feedback that shows its source

> Grade constrained short answers and reveal the supporting passage.

**Type:** Build  
**Language:** TypeScript  
**Stage:** 2 of 4  
**Time:** About 2 hours

## What you are building

For a beginner project, a narrow grading contract is easier to inspect than an unexplained model score. Normalize Unicode compatibility forms, case, whitespace and terminal sentence punctuation. Compare with the canonical answer and variants explicitly approved by the deck author. A different phrasing may be correct in ordinary language and still need manual review here.

```figure
pj-source-grounded-study-coach-2
```

## Work through an example

For paper envelopes, the response PAPER   ENVELOPES! is accepted after normalization. Plastic envelopes fails. An empty response fails even if punctuation disappears during normalization. If the author includes a paper envelope as a variant, that precise normalized variant is also accepted.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `normalizeAnswer(answer: string): string`
- `gradeAnswer(deck, cardId, response)`

Return cardId, correct, expected, quote, sourceId, start, end, method and feedback. Unknown card IDs and nonstring responses raise an error. Keep the original expected answer and quote in feedback; normalization belongs to comparison, not evidence rewriting.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Test positive and negative near-misses. A substring rule would incorrectly accept not paper envelopes. Keep exact equality and explicit variants visible in the method field. Do not interpret correctness as a confidence score.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py source-grounded-study-coach --init my-source-grounded-study-coach
python3 scripts/project_test.py source-grounded-study-coach --stage 2 --path my-source-grounded-study-coach
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What happens to a scientifically valid synonym absent from accepted? How would you let a teacher review these false negatives without weakening evidence requirements?

## Connect it to the finished artifact

A standalone answer-reveal practice page and progress.json with due cards and reproducible schedule state. The core uses authored questions and exact normalized answer matching. It does not judge arbitrary essays or infer understanding. The review intervals are a deterministic teaching policy, not an empirically validated learning-outcome claim. Source offsets use JavaScript UTF-16 code units.

After completing the project, try your own inputs:

```bash
cd my-source-grounded-study-coach
node --experimental-strip-types main.ts --deck ./fixtures/deck.json --attempts ./fixtures/attempts.json --initial-date 2026-09-01 --date 2026-09-03 --out ./study-output
```

Add an appeal event that stores the learner's response for a teacher. Keep review outcomes separate from automatic grades and version accepted-answer edits.

## Primary reference

[Official API documentation](https://nodejs.org/api/typescript.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
