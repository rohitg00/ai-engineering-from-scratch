# Inbox Triage Desk

Turn exported email into an evidence-backed review queue and unsent reply drafts.

You build an HTML review desk, triage.json, and downloadable unsent .eml drafts. Inputs: A directory of exported .eml messages. Only plain-text bodies are classified; HTML-only messages remain visible for manual review.

## Before you start

Python 3.10 or newer. The required core uses standard libraries and runs offline. Python ships MIME parsing, structured email generation and portable document export in its standard library.

- Read and write dictionaries and lists in Python.
- Understand a function returning a value or raising ValueError.
- Know that email headers and a MIME body are different data structures.

## Build it

```bash
python3 scripts/project_test.py inbox-triage-desk --init my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --stage 1 --path my-inbox-triage-desk
python3 scripts/project_test.py inbox-triage-desk --all --solution --strict
```

The first command creates an intentionally incomplete workspace. Later stages extend the same source file; their tests include new held-out inputs. Reference-solution passes verify the examples and do not earn a learner certificate.

## Use it

```bash
cd projects/inbox-triage-desk/solution
python3 main.py --input ./fixtures --out ./inbox-output
```

Open the resulting index.html locally. Copy the HTML and JSON into your own workflow, or import the named functions from main. The included demo runs the same implementation on original fixtures:

```bash
python3 demo.py
```

## Stages

1. [Read MIME without losing message identity](stages/01-parse-messages/docs/en.md)
2. [Group references and explain the queue](stages/02-group-and-triage/docs/en.md)
3. [Create an unsent draft with a source quote](stages/03-draft-for-review/docs/en.md)
4. [Export an auditable inbox desk](stages/04-export-the-desk/docs/en.md)

## What the result establishes

The default classifier uses explicit phrase rules, not an LLM. It handles a folder of exported messages and never connects to your mailbox or sends replies. Dates, urgency and promised actions are not inferred.

Optional: append --provider-url http://127.0.0.1:1234/v1/chat/completions --model YOUR_MODEL. An OpenAI-compatible chat endpoint receives message bodies only when explicitly selected. INBOX_MODEL_API_KEY supplies authentication if needed. Remote providers require HTTPS; HTTP is accepted only for localhost and explicit loopback IP addresses. URL credentials and redirects are rejected. Proposals must contain an exact source quote and stay in model-proposals.json for review; they do not overwrite the rule decisions.

Provider tests use controlled responses or loopback HTTP. They verify request and response contracts, not a model's quality or live service availability. No account connection, outgoing message, recurring task or cloud deployment is configured by this project.

## Make it your own

Replace the authored fixtures with a small export from your workflow and write down the expected result before running it. Preserve a second set of examples for evaluation. A useful before-and-after demonstration should show the input, inspectable intermediate evidence and portable output; it should not substitute a popularity claim for a measured result.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/email.parser.html). All project code, lesson prose and fixtures are original.
