# Reuse the policy inside the real ADK path

> A login ticket chooses read_account and access-recovery guidance. The fixture specialist replies using that guidance, and the final handoff stores the reply. A request for read_invoice under the access route raises PermissionError before a graph is run. Optional tests inspect model requests to ensure raw email and example keys did not cross the boundary.

**Type:** Build
**Stage:** 4 of 4
**Time:** About 2 hours

## The useful boundary

Compose the earlier lessons before importing or calling the framework. A cleaned, routed ticket receives one authorized read capability and authored guidance with a source ID. Ambiguous tickets escalate before any model call. A supplied model route cannot override this gate. ADK then propagates route and response through a real Workflow with two LlmAgent instances.

```figure
pj-support-agent-with-google-adk-4
```

## Work the example

A login ticket chooses read_account and access-recovery guidance. The fixture specialist replies using that guidance, and the final handoff stores the reply. A request for read_invoice under the access route raises PermissionError before a graph is run. Optional tests inspect model requests to ensure raw email and example keys did not cross the boundary.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `prepare_support, support_ticket, export_support in support.py; collect_events, run_adk in adk_adapter.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

Default ADK models are explicitly injected deterministic fixtures. Passing --adk --model YOUR_MODEL selects an actual ADK provider and requires its credentials. Even a live reply remains a draft requiring review; a prompt is not a proof of grounding. The capability is a local authored knowledge read in this example, not a connection to a billing or account service.

The starter supplies `KNOWLEDGE`, an original three-record dictionary keyed by specialist. Each value contains a stable source ID and guidance text: `billing-receipts`, `access-recovery` or `platform-status`. Treat this as input data. You implement the validation, authorization, composition and export around it.

`prepare_support` returns `ticket`, `session`, `tool` and `evidence`. Evidence is `{"source_id": id, "text": guidance}`. An unsupported or tied route has an escalated session and null tool/evidence. A disallowed explicit tool raises `PermissionError`. `support_ticket` adds a method label and stores the selected guidance as the session response for the deterministic baseline. `export_support` writes that result to support.json and an escaped review page to index.html.

`collect_events` accepts dictionaries with `author`, `text` and optional `state_delta`. Require a nonempty author, skip empty text and return rows with `agent`, `text` and a copied `state_delta`. The ADK result keeps the prepared fields and adds `events`, `state`, `handoff_prompt`, `model_requests` and `method`. State holds route and response. The resolved specialist prompt begins `Use the route billing` for a billing ticket. Record local fixture requests so tests can inspect the exact redacted boundary. An escalation returns empty events and requests before importing or running a model.

## Hints

Inspect events, final session state and the exported draft together. Framework-independent tests validate composition; --optional runs actual ADK 2.10.0 tests. A missing SDK is a skip, and strict optional grading fails rather than implying framework proficiency.

## Verify your work

```bash
python3 scripts/project_test.py support-agent-with-google-adk --init my-support-agent-with-google-adk
python3 scripts/project_test.py support-agent-with-google-adk --stage 4 --path my-support-agent-with-google-adk --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Which data is shared between the deterministic baseline and ADK? Why should a model-proposed route be prevented from silently expanding permissions?

The completed project produces an HTML review page and support.json with the redacted ticket, selected capability, source guidance, reply or escalation and state history.

```bash
cd projects/support-agent-with-google-adk/solution
python3 main.py --ticket fixtures/ticket.json --out support-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://google.github.io/adk-docs/). The implementation, policy choices and examples are original.
