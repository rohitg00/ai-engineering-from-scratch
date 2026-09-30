# Persist real Mastra approval state and resume it

> Start the authored workshop update and observe status=suspended with zero tool calls. Close the local LibSQL store, create a fresh workflow over the same SQLite file and resume by runId. Matching approval produces success and exactly one observed local tool call in the recovery test; a wrong hash fails with zero calls.

**Type:** Build
**Stage:** 4 of 4
**Time:** About 2 hours

## The useful boundary

Compose three real Mastra steps with Zod contracts: classify, plan and execute. The execution step calls Mastra suspend with ticketId, planHash, plan and reason when an update lacks approval. On resume, it validates approved, ticketId and planHash against the stored plan before calling the shared scratch executor.

```figure
pj-typed-workflow-agent-with-mastra-4
```

## Work the example

Start the authored workshop update and observe status=suspended with zero tool calls. Close the local LibSQL store, create a fresh workflow over the same SQLite file and resume by runId. Matching approval produces success and exactly one observed local tool call in the recovery test; a wrong hash fails with zero calls.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `createTicketWorkflow, planHash, persistentWorkflow in optional-mastra/adapter.ts` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The default factory uses InMemoryStore for lightweight tests. persistentWorkflow requires an explicit file: URL and @mastra/libsql 1.23.3 alongside @mastra/core 1.71.0 and Zod 4.3.6. The CLI writes approval.json with approved=false. Inspect the stored plan, explicitly edit approval and run the separate resume command. A false decision remains suspended.

## Hints

Run instructor-owned optional tests through project_test.py --optional --strict. The adapter invokes actual SDK suspension and resume; do not throw merely because the scratch policy would pause. Use the returned run ID, never start a new input to imitate a resume.

## Verify your work

```bash
python3 scripts/project_test.py typed-workflow-agent-with-mastra --init my-typed-workflow-agent-with-mastra
python3 scripts/project_test.py typed-workflow-agent-with-mastra --stage 4 --path my-typed-workflow-agent-with-mastra --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Which state survives a process restart and which external effects still need idempotency? How would you connect an authenticated review UI without trusting a model to approve its own plan?

The completed project produces a scratch HTML/JSON workflow review and a real Mastra run stored in SQLite with a plan-bound approval document.

```bash
cd projects/typed-workflow-agent-with-mastra/solution
node --experimental-strip-types cli.ts --ticket fixtures/ticket.json --out workflow-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://mastra.ai/docs/workflows/suspend-and-resume). The implementation, policy choices and examples are original.
