# Route and authorize as separate decisions

> invoice refund selects billing and can use read_invoice. invoice login ties billing and access, so it escalates. A billing route requesting read_account is rejected even though that tool is valid for another specialist.

**Type:** Build
**Stage:** 2 of 4
**Time:** About 2 hours

## The useful boundary

Count distinct domain words for billing, access and platform. Choose a route only when one domain has a unique positive score. Unknown topics and ties go to human review. Then check the selected specialist against a read-capability allowlist. A domain label never grants access to every tool.

```figure
pj-support-agent-with-google-adk-2
```

## Work the example

invoice refund selects billing and can use read_invoice. invoice login ties billing and access, so it escalates. A billing route requesting read_account is rejected even though that tool is valid for another specialist.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `route(text), authorize(specialist, tool) in routing.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The router is a transparent keyword baseline, not a semantic model. The capability check is deterministic and independent of classification confidence. The composed workflow calls it before selecting support evidence or constructing an agent graph.

The starter supplies these original policy inputs. Keep them separate from the scoring algorithm so a later policy change does not require rewriting the classifier.

| Specialist | Distinct lowercase words | Allowed capability |
| --- | --- | --- |
| billing | invoice, refund, payment | read_invoice |
| access | password, login, account | read_account |
| platform | outage, latency, error | read_status |

`route` returns one specialist name or `human`. `authorize` returns a boolean; an unknown specialist or capability returns false. Compare whole word tokens, so `payment` matches but `repayment` does not.

## Hints

Use a set of words so repeating invoice twenty times does not dominate the score. Test unknown tool names and human as a specialist. Keep ties explicit rather than choosing alphabetically.

## Verify your work

```bash
python3 scripts/project_test.py support-agent-with-google-adk --init my-support-agent-with-google-adk
python3 scripts/project_test.py support-agent-with-google-adk --stage 2 --path my-support-agent-with-google-adk --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Why would using a model to label a request still leave this authorization function necessary? What evidence would you need before adding a write capability?

The completed project produces an HTML review page and support.json with the redacted ticket, selected capability, source guidance, reply or escalation and state history.

```bash
cd projects/support-agent-with-google-adk/solution
python3 main.py --ticket fixtures/ticket.json --out support-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://google.github.io/adk-docs/). The implementation, policy choices and examples are original.
