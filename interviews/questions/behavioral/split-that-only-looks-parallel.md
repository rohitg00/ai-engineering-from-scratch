---
id: split-that-only-looks-parallel
title: Decide whether to split work across parallel workers
card: behavioral
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, inference-engineer]
rounds: [behavioral]
tags: [delegation, isolation, merge-contract, parallelism]
minutes: 12
lessons: [phases/14-agent-engineering/45-delegate-with-isolation]
manuals: []
practice: []
cheatsheet: [delegation-feedback]
related: [behavioral/plan-you-would-reject, behavioral/agent-decides-alone]
updated: 2026-11-03
---

Your manager wants a feature finished faster and suggests that you run two coding agents, or two engineers, in parallel on it. Tell me about a time you had to make that call. How did you decide, and what did you put in place before anyone started?

## Short answer

I delegate only when the work is really independent: two investigations that answer different unknowns, two implementations with disjoint files and contracts, a reviewer who only reads, or a slow external check that runs while local work continues. When the parts need the same files, the same open decision or the same mutable environment, I keep them serial, because a parallel split then converts one clear task into a coordination problem. Before anyone starts, each unit gets a goal, an owner, exclusive write paths, dependencies, a proof and a handoff.

## Full answer

### The parallelism test

More available workers is not a reason. The split is justified when at least one of these holds:

- two investigations can answer different unknowns on their own;
- two implementations own disjoint files and contracts;
- a reviewer can inspect a finished artifact without changing it;
- a slow external check can run while local work continues.

### A work unit is a contract

"Handle the backend" is not a unit. "Implement the duplicate check in one named file and prove it with the focused account test" is. Each unit records the goal, one accountable owner, exclusive paths, completed units it waits for, the exact evidence it returns, and a handoff with the files changed, the decisions made and the remaining risk.

### Three layers of isolation

1. Filesystem: separate worktrees or sandboxes stop accidental shared edits.
2. Ownership: the contract stops two workers from editing the same path on purpose.
3. State: separate logs and outputs stop one worker from overwriting another's evidence.

Filesystem isolation does not solve ownership. Two clean worktrees can still produce two conflicting designs. The merge contract has to settle shared interfaces before work begins.

### What the integrator does

The integrator confirms each handoff matches its scope, reads the proof output rather than the summary, combines changes in dependency order, runs the full cross-unit gate, rejects hidden scope growth, and records conflicts as new decisions instead of silent edits. If integration means rewriting most of a worker's result, the split was wrong.

### The call I made

The time this mattered most, the two halves looked independent but both needed the same response type to change. I ran one short unit to fix that contract first, then let the two implementations run in parallel against it. The serial step was shorter than the merge conflict it prevented.

## Follow-ups

- **Level 3:** A docs unit asks to own the whole application directory. What happens? Expected: the plan is blocked, because that parent path overlaps the paths of the implementation unit.
- **Level 3:** A worker's dependency becomes invalid half way through. What is the rule? Expected: a written cancellation rule decided before the start, so the worker stops and returns a handoff instead of building on a dead contract.
- **Level 4:** Where does the human stay in the loop when agents do the work? Expected: on choices that change public behavior, risk, authority or irreversible cost; agents own bounded investigation, implementation, verification and review.
- **Level 4:** How do you know the decomposition was right after the fact? Expected: the integrator combined the handoffs without rewriting them, and the final changed-file set matched the union of the unit contracts.

## Wrong answers

- "Two agents are always faster than one." Parallel work saves wall time only when the pieces are independent; otherwise it raises the failure rate.
- "Separate worktrees solve the conflicts." They prevent accidental shared edits, not two conflicting designs of one interface.
- "The integrator fixes whatever does not fit." If most of a result must be rewritten at integration, the original split was the mistake.

## Taught in

The [delegation lesson](../../../phases/14-agent-engineering/45-delegate-with-isolation/) gives the parallelism test, the unit contract and the isolation layers.
