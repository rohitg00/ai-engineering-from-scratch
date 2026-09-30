# Make the approval invariant explicit in the plan

> An update action with requiresApproval=false fails. A lookup-only plan with requiresApproval=true also violates the stated representation. One through ten actions are allowed, and every action has a supported tool and nonempty query.

**Type:** Build
**Stage:** 2 of 4
**Time:** About 2 hours

## The useful boundary

A read classification creates lookup; a write classification creates update. Validate the resulting plan again at execution because it may have been serialized or edited. The requiresApproval flag must equal whether any action is update. This prevents one boolean from silently disabling a gate.

```figure
pj-typed-workflow-agent-with-mastra-2
```

## Work the example

An update action with requiresApproval=false fails. A lookup-only plan with requiresApproval=true also violates the stated representation. One through ten actions are allowed, and every action has a supported tool and nonempty query.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `makePlan(classification), validatePlan(plan) in main.ts` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The scratch checkpoint is local JSON, not authenticated authorization. The optional framework stores the actual plan and binds approval to its digest and ticket ID. A digest detects mismatched context; it does not identify who approved the operation.

## Hints

Test a valid plan, then modify one field at a time. Check the action list before counting write tools. Keep the query unchanged so a resumed workflow cannot quietly execute a rewritten request.

## Verify your work

```bash
python3 scripts/project_test.py typed-workflow-agent-with-mastra --init my-typed-workflow-agent-with-mastra
python3 scripts/project_test.py typed-workflow-agent-with-mastra --stage 2 --path my-typed-workflow-agent-with-mastra --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

What additional identity and access controls would a public approval endpoint need? Why is a plan hash alone insufficient?

The completed project produces a scratch HTML/JSON workflow review and a real Mastra run stored in SQLite with a plan-bound approval document.

```bash
cd projects/typed-workflow-agent-with-mastra/solution
node --experimental-strip-types cli.ts --ticket fixtures/ticket.json --out workflow-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://mastra.ai/docs/workflows/suspend-and-resume). The implementation, policy choices and examples are original.
