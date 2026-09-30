# Suspend before effects and count failed attempts

> A lookup returning a result completes in one call. A tool returning empty text twice fails after two calls. A write without approval returns a checkpoint and zero calls; resuming that checkpoint with approved=true executes the original query.

**Type:** Build
**Stage:** 3 of 4
**Time:** About 2 hours

## The useful boundary

Execute an injected tool under both a shared call budget and a per-action retry bound. Failed calls consume the budget. Unapproved writes return suspended with a detached plan before any tool call. Empty tool output counts as failure because it provides no usable answer.

```figure
pj-typed-workflow-agent-with-mastra-3
```

## Work the example

A lookup returning a result completes in one call. A tool returning empty text twice fails after two calls. A write without approval returns a checkpoint and zero calls; resuming that checkpoint with approved=true executes the original query.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `executePlan(plan, tool, options), runTicket(raw, tool, options) in main.ts` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The scratch runtime is in memory and has no crash recovery during a tool call. Tools used in the CLI are explicitly local simulations. Real writes need idempotency keys because a network failure can occur after a remote system applied the action but before the response arrived.

## Hints

Inject a tool that records each invocation. Assert both the returned status and the actual call list. Validate budgets before entering loops. Keep suspended distinct from failed so a review queue can resume work rather than retrying an error.

## Verify your work

```bash
python3 scripts/project_test.py typed-workflow-agent-with-mastra --init my-typed-workflow-agent-with-mastra
python3 scripts/project_test.py typed-workflow-agent-with-mastra --stage 3 --path my-typed-workflow-agent-with-mastra --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Why must a failed call count toward the budget? What evidence distinguishes a suspended workflow from a completed write whose response was lost?

The completed project produces a scratch HTML/JSON workflow review and a real Mastra run stored in SQLite with a plan-bound approval document.

```bash
cd projects/typed-workflow-agent-with-mastra/solution
node --experimental-strip-types cli.ts --ticket fixtures/ticket.json --out workflow-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://mastra.ai/docs/workflows/suspend-and-resume). The implementation, policy choices and examples are original.
