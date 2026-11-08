---
id: router-or-manual
title: A short router or a long manual for the agent
card: agents
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [design-review, ml-breadth]
tags: [agents-md, router, progressive-disclosure, instructions, context-budget]
minutes: 10
lessons: [phases/14-agent-engineering/32-minimal-agent-workbench, phases/14-agent-engineering/33-instructions-as-executable-constraints]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, coding-agents]
related: [agents/seven-surfaces-one-symptom-each]
updated: 2026-11-03
---

A repo has a 3000-line instructions file for its coding agent. The agent follows about half of it. One engineer wants to cut it to a page. Another says that every line came from an incident and nothing can go. How do you settle it?

## Short answer

Both are right about something, and the answer is a layered file set, not a shorter file. Keep a root router under about 50 lines that holds only pointers and the few hard rules. Move the rules into a rules file with one screen per category, and move the depth into topic documents that the agent loads only when a task touches them. Every rule stays, and the agent reaches any rule in at most two hops.

## Full answer

### Why the long file fails

The model loads the file, reads the first screen, runs out of attention budget, and acts on a fraction of what it was told. A long manual fails for the same reason a forty-page onboarding document fails. The reader skims it once and never returns to the part that mattered. Long manuals get ignored. Short routers get followed.

### The three tiers

| Tier | Lives in | Read when | Size |
|---|---|---|---|
| Router | the root instructions file | Every session | Under about 50 lines |
| Rules | `docs/agent-rules.md` | Every session, at startup | One screen per category |
| Topic docs | `docs/<topic>.md` | Only when the task touches that topic | As deep as needed |

The router points at the state file, the task board, the rules and the verification command. It links every topic document by path, not by description.

### Two tests that keep it honest

- **Reachability.** The agent reaches any rule in at most two hops from the router. A pointer that no longer resolves is worse than a missing rule, so a broken link in the router is itself a startup violation.
- **Freshness.** The router is short enough that a reviewer reads it again on every pull request. That is the only thing that stops it from growing back into the manual.

### What to refuse while you trim

The lesson lists anti-patterns that look like coverage. Conflicting instructions silently drop the agent from asking to guessing; one measurement put the resolve rate at 48.8 percent with clear instructions and 28 percent with conflicting ones. A style rule with no lint command lets the agent invent compliance, so pair every style rule with its command. Lead with commands and end with style. Write for the agent, not for a human reader, because terseness saves context.

### Nested files

Large repos keep one router per subcomponent. Tools walk from the working file to the root and concatenate every router they find, so a subdirectory file extends the root file. One large repository in the lesson carries 88 of them. Measurements in the lesson place the best files at a quality jump equal to a model upgrade, and the worst files below no file at all.

## Follow-ups

- **Level 2:** The team keeps a rule in the router because it is important. What is the test for whether it belongs there? Expected: the router holds pointers and the few hard rules that apply to every session, and anything that applies to one kind of task goes in a topic document.
- **Level 2:** How do you keep one source of truth when the team uses several coding agents? Expected: one root file and symlinks with the names each tool expects, so that every tool reads the same text.
- **Level 3:** What does a lint for the workbench check? Expected: the router is under the line budget, every path it references exists, and no two rules conflict.
- **Level 3:** Why does the lesson rank a dead link below a rule that was never written? Expected: the agent trusts the router, follows the pointer, finds nothing, and proceeds as if the rule did not exist, while a missing rule at least leaves no false promise.

## Wrong answers

- "Cut the file to one page and delete the rest." The rules came from incidents, and deleting them repeats the incidents, so move them to tiers instead.
- "Keep the long file, and tell the agent to read all of it." The model has an attention budget, and an instruction to read everything does not change how much it acts on.
- "Put the file in the system prompt so that it is always in context." Being in context is not the problem; acting on it is, and a short router with pointers gets followed where a long block does not.

## Taught in

The [minimal workbench lesson](../../../phases/14-agent-engineering/32-minimal-agent-workbench/) makes the router one of three files, and the [executable constraints lesson](../../../phases/14-agent-engineering/33-instructions-as-executable-constraints/) gives the tiers and the two tests.
