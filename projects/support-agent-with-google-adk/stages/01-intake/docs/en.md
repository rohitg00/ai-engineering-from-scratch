# Validate before starting a session

> For invoice for sam@example.invalid api_key=EXAMPLE_TOKEN, the usable ticket text becomes invoice for [email] api_key=[redacted]. An empty string fails before routing. The same cleaned text must reach both the baseline and ADK path.

**Type:** Build
**Stage:** 1 of 4
**Time:** About 2 hours

## The useful boundary

A support request is an external input. Require a nonempty ID and 1 to 10,000 characters of text before creating any session. Replace the documented email pattern with [email] and API-key values with [redacted]. Keep the ticket ID so later events can refer to it without retaining raw contact details.

```figure
pj-support-agent-with-google-adk-1
```

## Work the example

For invoice for sam@example.invalid api_key=EXAMPLE_TOKEN, the usable ticket text becomes invoice for [email] api_key=[redacted]. An empty string fails before routing. The same cleaned text must reach both the baseline and ADK path.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `ticket(raw) in intake.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The regexes cover only the stated patterns. They do not establish that arbitrary personal data, passwords or every credential format has been removed. Keep raw text out of model requests and exported reports, and test the known patterns at the final integration boundary.

## Hints

Trace the value from raw input through the returned dictionary. Test an email and key together, not only separately. Do not log raw input when reporting a validation error.

## Verify your work

```bash
python3 scripts/project_test.py support-agent-with-google-adk --init my-support-agent-with-google-adk
python3 scripts/project_test.py support-agent-with-google-adk --stage 1 --path my-support-agent-with-google-adk --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Which parts of a real ticket remain sensitive after these two substitutions? Where would a production data-minimization policy belong?

The completed project produces an HTML review page and support.json with the redacted ticket, selected capability, source guidance, reply or escalation and state history.

```bash
cd projects/support-agent-with-google-adk/solution
python3 main.py --ticket fixtures/ticket.json --out support-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://google.github.io/adk-docs/). The implementation, policy choices and examples are original.
