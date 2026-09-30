# Export an auditable inbox desk

> Write portable HTML, JSON and draft files from the same review records.

**Type:** Build  
**Language:** Python  
**Stage:** 4 of 4  
**Time:** About 2 hours

## What you are building

The export is the useful end product. Someone should be able to inspect the input, category, reason and exact matched phrase without running Python. Sort entries by priority and then message ID so repeated exports are easy to compare. Keep the JSON report as the integration boundary for another app.

```figure
pj-inbox-triage-desk-4
```

## Work through an example

The authored repair-event fixture has one action message, one informational reply and one unclear note. It becomes two threads and three queue entries. Opening index.html shows each full body and a downloadable unsent draft; triage.json retains thread membership and evidence offsets.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `export_desk(messages, out: Path, rules=None) -> dict`

Write index.html and triage.json plus one digest-named .eml per unique message. Never use a subject or sender directly as a filename. Escape all message text and subjects in HTML. Include a schema version, rule method and review-required status. Empty input still exports a valid empty desk.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use one report structure for JSON and HTML rendering to prevent divergent totals. Put an HTML-like string in a test subject and verify it is escaped. Verify a draft file actually exists rather than only testing its displayed link.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py inbox-triage-desk --init my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --stage 4 --path my-inbox-triage-desk
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What survives if you move the output directory to another computer? What additional agreement would a consumer need before depending on your JSON format?

## Connect it to the finished artifact

An HTML review desk, triage.json, and downloadable unsent .eml drafts. The default classifier uses explicit phrase rules, not an LLM. It handles a folder of exported messages and never connects to your mailbox or sends replies. Dates, urgency and promised actions are not inferred.

After completing the project, try your own inputs:

```bash
cd my-inbox-triage-desk
python3 main.py --input ./fixtures --out ./inbox-output
```

Import triage.json into a local dashboard, or add a reviewed decision file keyed by message ID. Keep edits distinct from the original evidence.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/email.parser.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
