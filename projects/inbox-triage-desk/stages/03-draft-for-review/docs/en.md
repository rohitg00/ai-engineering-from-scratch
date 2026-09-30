# Create an unsent draft with a source quote

> Generate reviewable email drafts without inventing commitments.

**Type:** Build  
**Language:** Python  
**Stage:** 3 of 4  
**Time:** About 2 hours

## What you are building

A classification does not tell you what the reply should promise. The offline draft quotes the first source line, then leaves a clearly marked place for your response. Use EmailMessage to serialize headers and line endings. Do not assemble raw headers by string concatenation.

```figure
pj-inbox-triage-desk-3
```

## Work through an example

For a sender asking Could you lend two chairs?, the draft points to that sentence and contains [Write and check your response here.]. It does not say that chairs are available. X-Unsent: 1 identifies the intended draft workflow; the project has no SMTP call.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `build_draft(message: dict, decision: dict) -> dict`
- `provider_proposal(message, endpoint, model, api_key="") -> dict`

Check that the decision belongs to the message and every supplied evidence span matches. Return message_id, to, subject, body, eml, status=draft-only and source_quote. Add In-Reply-To and deduplicated References. The optional HTTP classifier must reject unsupported categories, empty quotes and quotes absent from the body. It returns review_required=True. Require HTTPS for remote endpoints. Permit HTTP only for localhost or an explicit loopback IP address (IPv4 or IPv6), with a valid hostname and port. Reject URL credentials, fragments and whitespace. Use a dedicated urllib opener whose HTTPRedirectHandler.redirect_request returns None, so all redirects fail before a second request can forward credentials.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Parse your generated .eml again with BytesParser and inspect the recipient and thread headers. For the adapter, test the serialized request against a local server or a mocked transport; an offline test does not establish live model quality.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py inbox-triage-desk --init my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --stage 3 --path my-inbox-triage-desk
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Why is a grounded quote insufficient to verify a model's chosen category? Which component would you change to draft more useful replies while preserving review?

## Connect it to the finished artifact

An HTML review desk, triage.json, and downloadable unsent .eml drafts. The default classifier uses explicit phrase rules, not an LLM. It handles a folder of exported messages and never connects to your mailbox or sends replies. Dates, urgency and promised actions are not inferred.

After completing the project, try your own inputs:

```bash
cd my-inbox-triage-desk
python3 main.py --input ./fixtures --out ./inbox-output
```

Compare model proposals with your phrase baseline on a held-out set you label yourself. Report disagreements; do not call every model output an improvement.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/email.parser.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
