# Read MIME without losing message identity

> Parse exported messages and preserve their exact plain-text evidence.

**Type:** Build  
**Language:** Python  
**Stage:** 1 of 4  
**Time:** About 2 hours

## What you are building

An email is a structured message, not a body obtained by splitting at the first blank line. MIME can contain multiple alternatives, attachments and transfer encodings. Use BytesParser with an explicit policy, then select the plain-text body. Keep the sender, subject, message ID, reference IDs and body status beside the text.

```figure
pj-inbox-triage-desk-1
```

## Work through an example

A message with From: Ada <ada@example.invalid>, Message-ID: <a@example.invalid>, and the body Please reserve a chair produces sender ada@example.invalid and the exact body text. A second HTML alternative must not replace that text. If Message-ID is absent, a digest of the original bytes supplies stable local identity.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `parse_message(raw: bytes) -> dict`

Return keys id, sender, subject, text, references and body_status. Reject empty input, input larger than 1,000,000 bytes, and missing sender addresses. Collapse whitespace in the subject but preserve body line breaks. Deduplicate reference IDs. An HTML-only body becomes empty text with no-plain-body status.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Start with one plain message, then construct multipart/alternative. Prefer the parser's get_body over traversing every text part: an attached text file is not the email body. Test fallback IDs by parsing the same bytes twice.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py inbox-triage-desk --init my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --stage 1 --path my-inbox-triage-desk
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Why must two messages with the same subject still keep separate identities? What information would be lost if HTML were silently converted to plain text?

## Connect it to the finished artifact

An HTML review desk, triage.json, and downloadable unsent .eml drafts. The default classifier uses explicit phrase rules, not an LLM. It handles a folder of exported messages and never connects to your mailbox or sends replies. Dates, urgency and promised actions are not inferred.

After completing the project, try your own inputs:

```bash
cd my-inbox-triage-desk
python3 main.py --input ./fixtures --out ./inbox-output
```

Add a local attachment inventory with names and sizes. Keep attachments separate from text used for triage.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/email.parser.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
