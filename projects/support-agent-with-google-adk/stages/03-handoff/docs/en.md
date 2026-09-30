# Retain the actual response in the handoff

> begin followed by classify on invoice then respond with Check the invoice reference produces answered and retains response="Check the invoice reference". The history records classify and respond. Classifying invoice login followed by respond fails; escalate is the valid transition.

**Type:** Build
**Stage:** 3 of 4
**Time:** About 2 hours

## The useful boundary

Model the ticket as received, routed, then answered or escalated. A response before classification is invalid. A human route cannot become answered automatically. Return a new state and copy its history so a failed operation does not partially mutate the caller's prior state.

```figure
pj-support-agent-with-google-adk-3
```

## Work the example

begin followed by classify on invoice then respond with Check the invoice reference produces answered and retains response="Check the invoice reference". The history records classify and respond. Classifying invoice login followed by respond fails; escalate is the valid transition.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `begin(ticket), transition(session, event, payload=None) in handoff.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

Respond requires nonempty text and stores that text in response. Escalation stores an escalation_reason. Answered and escalated are terminal states. The exported response must come from this state, so successful execution produces a usable draft instead of only a transition log.

`begin` returns `ticket_id`, `state="received"`, `route=None` and an empty `history`. Each successful transition appends `{"event": event, "state": next_state}` to a copied history. Classification sets `route` using stage 2. Respond trims and stores `response`; escalation stores the supplied reason or `Human review required` when none is given. Invalid transitions raise `ValueError` without changing the input session.

## Hints

Compare the original state before and after a transition. Assert that it is unchanged and the returned history grew by one. Then assert that the response text survived, not just that state equals answered.

## Verify your work

```bash
python3 scripts/project_test.py support-agent-with-google-adk --init my-support-agent-with-google-adk
python3 scripts/project_test.py support-agent-with-google-adk --stage 3 --path my-support-agent-with-google-adk --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

What would you store to recover this state after a process restart? Does a retained answer prove that a model generated it from authorized evidence?

The completed project produces an HTML review page and support.json with the redacted ticket, selected capability, source guidance, reply or escalation and state history.

```bash
cd projects/support-agent-with-google-adk/solution
python3 main.py --ticket fixtures/ticket.json --out support-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://google.github.io/adk-docs/). The implementation, policy choices and examples are original.
