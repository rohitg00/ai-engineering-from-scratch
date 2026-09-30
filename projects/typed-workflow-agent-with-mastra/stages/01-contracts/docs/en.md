# Validate typed step inputs at runtime

> Find the workshop policy produces read intent. Update the workshop label produces write intent. A blank ID fails before a tool is chosen. The word change inside unchanged does not match the mutation-verb word boundary.

**Type:** Build
**Stage:** 1 of 4
**Time:** About 2 hours

## The useful boundary

A TypeScript type does not validate a JSON file. Require a nonempty ID and message, trim both and reject messages beyond 10000 characters. Then use the explicit mutation verbs update, delete, change and cancel as an educational intent baseline. Keep the classifier's limits visible.

```figure
pj-typed-workflow-agent-with-mastra-1
```

## Work the example

Find the workshop policy produces read intent. Update the workshop label produces write intent. A blank ID fails before a tool is chosen. The word change inside unchanged does not match the mutation-verb word boundary.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `parseTicket(raw), classify(raw) in main.ts` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The selected tool determines the later approval requirement. A word list cannot authorize real-world actions or reliably infer every natural-language intention. The output is a typed classification with the original validated ticket, intent and topic.

## Hints

Write a table of phrases that expose false positives and false negatives. Test runtime input types separately from classification behavior. Node strips TypeScript annotations; it does not run a static type checker for you.

## Verify your work

```bash
python3 scripts/project_test.py typed-workflow-agent-with-mastra --init my-typed-workflow-agent-with-mastra
python3 scripts/project_test.py typed-workflow-agent-with-mastra --stage 1 --path my-typed-workflow-agent-with-mastra --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Which validation belongs at the transport boundary, and which decision belongs in a tool capability check?

The completed project produces a scratch HTML/JSON workflow review and a real Mastra run stored in SQLite with a plan-bound approval document.

```bash
cd projects/typed-workflow-agent-with-mastra/solution
node --experimental-strip-types cli.ts --ticket fixtures/ticket.json --out workflow-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://mastra.ai/docs/workflows/suspend-and-resume). The implementation, policy choices and examples are original.
