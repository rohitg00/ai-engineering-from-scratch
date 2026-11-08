---
id: retire-a-rule
title: Decide what to delete from a bloated instruction file
card: behavioral
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [behavioral]
tags: [controls, retirement, instructions, agent-workbench]
minutes: 10
lessons: [phases/14-agent-engineering/46-turn-feedback-into-system, phases/14-agent-engineering/54-build-the-feedback-ratchet]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, delegation-feedback]
related: [behavioral/correction-to-control, behavioral/feedback-ratchet-owner]
updated: 2026-11-03
---

A team's agent instruction file has grown for a year. Rules contradict each other, the context is heavy, and nobody remembers why half of them exist. You are asked to clean it up. How do you decide what stays, what goes, and what you will not touch yet?

## Short answer

Every control needs a retirement condition, and retirement needs evidence like any other change. I review each rule against four questions: did the architecture or workflow it protected change, did a stronger executable control replace it, has the failure stayed away across a meaningful window, and does the rule block legitimate work more often than it prevents harm. A rule that passes none of those stays, and a rule I cannot trace to a cause gets an owner and a review date before it gets deleted.

## Full answer

### Why the file grew

Each rule was a correction promoted into prose. Prose is the weakest durable layer. Over a year the rules encoded a system that no longer exists, started to conflict, and now consume context on every run. The goal is not the longest instruction file. It is the smallest system that preserves hard-won judgment.

### The review

| Question | If yes |
|---|---|
| Did the architecture or workflow change? | The rule protects a system that is gone; retire it |
| Did a type, a test or a permission replace it? | Delete the prose and keep the executable control |
| Has the failure not recurred across the window? | Retire it, and note the window as the evidence |
| Does it block legitimate work more than it prevents harm? | Rewrite it narrower or retire it |

### Replace before delete

For a rule that still protects a real risk, the better move is often promotion rather than retirement: a prose rule about output shape becomes an example plus a validator, a prose rule about files becomes a scope policy. I delete the sentence only after proving the stronger control exists and fires.

### What I do not touch yet

A rule with no recorded cause and no owner is a gap in the record, not a candidate for deletion. I give it an owner and a review date, and I look for the correction that created it. Deleting it because it feels old is the mistake the lesson warns against.

### Guard against regrowth

Every new control gets an owner, a verification, a review or expiry window and a retirement condition when it is created. Without that, the file fills again in a year.

## Follow-ups

- **Level 3:** Two rules contradict each other. What do you do first? Expected: find the cause behind each; a contradiction usually means one of them protects a system or decision that changed.
- **Level 3:** A rule has not fired in months. Is that enough to delete it? Expected: only if the window is meaningful for that failure and the risk it protected is still visible elsewhere; low frequency with high consequence can keep a rule alive.
- **Level 4:** How do you show that a deletion was safe? Expected: the stronger control that replaced it fires on the original failure case, and the recurrence stays absent across the review window.
- **Level 4:** What stops the file from growing back? Expected: a creation rule that every control carries an owner, a verification and a retirement condition, with periodic review.

## Wrong answers

- "Delete everything older than a year and see what breaks." Retirement needs evidence; a silent failure can take months to appear.
- "Keep all of it, context is cheap." Stale rules conflict, encode a dead system and bloat every run.
- "Rewrite the whole file from scratch." The file holds judgment that was paid for; the job is to move it to stronger layers, not to lose it.

## Taught in

The [feedback-to-system lesson](../../../phases/14-agent-engineering/46-turn-feedback-into-system/) gives the retirement checks and the [feedback ratchet lesson](../../../phases/14-agent-engineering/54-build-the-feedback-ratchet/) gives the ownership and expiry fields.
