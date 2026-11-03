---
id: leave-work-resumable
title: Leave work so that someone else can resume it
card: behavioral
kind: concept
level: 1
roles: [agentic-ai-engineer, applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [behavioral, screen]
tags: [handoff, planning, resumable-work]
minutes: 6
lessons: [phases/14-agent-engineering/44-plan-from-evidence]
manuals: []
practice: []
cheatsheet: [agent-planning]
related: [behavioral/plan-you-would-reject]
updated: 2026-11-03
---

Your session ends without warning in the middle of a multi-step change, and a colleague picks it up the next morning. What must they be able to find, and where?

## Short answer

They need to see which items are done, which proof ran for each one, which files changed, which dependencies are now unblocked, and what the next safe item is. That state lives next to the work, in the repository, as small items with explicit proof, not as checked boxes inside a chat.

## Full answer

### Design for interruption

Sessions end unexpectedly. A resumable plan has work items small enough that another person, or another agent, can determine the state of each one from the artifacts alone. The five things they must be able to read:

- which item is complete;
- which proof ran and what it returned;
- which artifacts changed;
- which dependencies are now unblocked;
- what the next safe item is.

### Why chat is the wrong place

A checked box in a conversation says that someone believed an item was done. It does not say which command proved it or which files it touched. The next person either trusts the box or redoes the work. A plan stored next to the code, with one identifier per item and the proof command written down, lets them verify instead of trust.

### The habit

I stop at item boundaries when I can. When I cannot, the plan still shows the last proof that passed, so the resume point is the first item whose proof has not run.

## Follow-ups

- **Level 1:** Where do you keep the plan? Expected: in the repository next to the work, as the source of truth, with any rendering such as a Markdown view generated from it.
- **Level 2:** An item is marked done but has no proof recorded. What does the colleague do? Expected: treat it as not done and run its proof; a box without proof is a belief.
- **Level 2:** Why does item size matter for resumption? Expected: a small item either finished or did not; a large half-done item forces the next person to reconstruct where it stopped.

## Wrong answers

- "Write a summary message at the end of the session." The session can end before the summary; the state must exist as the work proceeds.
- "The git log is enough." Commits show what changed, not which proof ran or which item is next.
- "Only the person who started can finish it." That is the failure the plan should prevent.

## Taught in

The [evidence-backed plan lesson](../../../phases/14-agent-engineering/44-plan-from-evidence/) covers designing a plan for interruption and storing it next to the work.
