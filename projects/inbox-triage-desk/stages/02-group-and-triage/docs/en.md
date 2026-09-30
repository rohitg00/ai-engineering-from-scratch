# Group references and explain the queue

> Use message references for threads and explicit phrases for triage.

**Type:** Build  
**Language:** Python  
**Stage:** 2 of 4  
**Time:** About 2 hours

## What you are building

A subject is not a reliable thread key. Two unrelated senders can use the same subject, and a thread can change its subject. Build connections only when a References or In-Reply-To ID exists in the imported set. Connected messages form a thread even when input order changes.

```figure
pj-inbox-triage-desk-2
```

## Work through an example

Three messages a, b referencing a, and c referencing b belong to one thread. A fourth message with the same subject and no reference stays separate. For triage, Please confirm matches action. For your information matches information. A body containing both is uncertain, because choosing a single winning rule would hide the conflict.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `group_threads(messages: list[dict]) -> list[dict]`
- `triage(message: dict, rules: dict | None = None) -> dict`

Return stable thread IDs and messages sorted by ID. Identical duplicates collapse; conflicting records with the same ID raise ValueError. Rule categories are action and information; unmatched or conflicting categories become uncertain. Each hit contains category, quote, start and end, with text[start:end] equal to quote. Priorities are action=0, uncertain=1, information=2.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Represent thread connections independently from display order. Check phrase boundaries so please does not match displeased. Find spans in the original body with case-insensitive matching rather than searching a case-folded string whose offsets might change.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py inbox-triage-desk --init my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --stage 2 --path my-inbox-triage-desk
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Does a matching phrase prove that a request is urgent or legitimate? Why should uncertain items appear before informational items?

## Connect it to the finished artifact

An HTML review desk, triage.json, and downloadable unsent .eml drafts. The default classifier uses explicit phrase rules, not an LLM. It handles a folder of exported messages and never connects to your mailbox or sends replies. Dates, urgency and promised actions are not inferred.

After completing the project, try your own inputs:

```bash
cd my-inbox-triage-desk
python3 main.py --input ./fixtures --out ./inbox-output
```

Add user-maintained sender preferences as a separate explicit ranking signal. Keep the matched phrase and rule method visible.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/email.parser.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
