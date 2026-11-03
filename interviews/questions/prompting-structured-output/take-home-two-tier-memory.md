---
id: take-home-two-tier-memory
title: Build a two-tier agent memory with eviction and citations
card: prompting-structured-output
kind: take-home
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [take-home]
tags: [agent-memory, virtual-context, eviction, citations, take-home]
minutes: 60
lessons: [phases/14-agent-engineering/07-memory-virtual-context-memgpt]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/sleep-time-consolidation, prompting-structured-output/fusion-weights-per-product]
updated: 2026-11-03
---

Take-home. Build an agent memory with two tiers: a fixed-size main context and an unbounded searchable store, plus the tools that move facts between them. Show a trace where the main context fills, something is evicted, and a later question is still answered from the store. Standard library only. Explain your eviction and citation choices.

## Short answer

Treat the main context as RAM and the store as disk. Give the main context a cap, a pinned core section and a message list that compacts its oldest entries when the cap is passed; give the store records with an id, text, tags, a session id and a turn id, and a token-overlap search. Expose the memory tools, write three facts, overflow the main context, and answer the follow-up by searching the store and splicing the result into the next turn.

## Full answer

### The shape

| Operating system | Memory system | Your code |
|---|---|---|
| RAM | main context | a capped buffer with a core dict and a message list |
| Disk | external store | a list of records with a search method |
| Page fault | memory tool call | the agent calls a tool, the runtime runs it, the result enters the next turn |
| Kernel | agent control loop | a scripted loop that reads, decides, writes |

### The tool surface

- `core_memory_append(section, text)` and `core_memory_replace(section, old, new)` edit the pinned sections of the main context.
- `archival_memory_insert(text)` writes a record to the store.
- `archival_memory_search(query, top_k)` retrieves from the store.
- `conversation_search(query)` scans past turns.

### Eviction

When the message list passes the cap, compact the oldest messages instead of dropping them. The lesson's exercise measures the cap in tokens with a word count times 1.3 and summarizes the evicted messages; a simpler version moves them to the store. Deletion loses facts that the store could have kept.

### Citations

Every store record carries the session id and the turn id of its source. Without them the agent recalls that the user asked for something and cannot say which turn; with them every retrieval-backed answer can cite its origin.

### The trace a grader wants

1. Three facts written to the store, each with its source fields.
2. The main context fills past the cap and the oldest messages are compacted.
3. A follow-up question arrives, the agent calls the search tool, the hit is spliced into the next turn, and the answer cites the turn.
4. A note on the two failures that the design does not fix on its own: memory rot, which needs periodic consolidation, and memory poisoning, where attacker text stored as a note is re-ingested next session.

## Follow-ups

- **Level 3:** Why page instead of using a larger window? Expected: overflow, dilution and persistence; a bigger window still dilutes attention and starts empty next session, and the lesson cites a 4k-window agent with external memory that caught long-horizon facts a 128k-window baseline missed.
- **Level 3:** What goes in every store record, and why? Expected: the text, tags, the session id and the turn id, so a recalled fact can be cited to the turn it came from.
- **Level 4:** A note in the store says to ignore all future user instructions. What is the guard? Expected: scan retrieved records for directive-shaped text and mark them untrusted before they reach the prompt; this is prompt injection over time.
- **Level 4:** Writes outnumber reads and retrieval drowns in stale facts. What do you add? Expected: periodic consolidation and explicit invalidation of contradicted facts, which the later memory lessons run off the critical path.

## Wrong answers

- "Keep everything in the context, the window is large enough." The lesson's three failures remain: overflow, dilution and an empty window at the next session.
- "Evict by deleting the oldest messages outright." Compact them into a summary or move them to the store; deletion loses facts the store could have kept.
- "The store does not need source fields." Without a session and a turn id the agent recalls a fact and cannot say where it came from.

## Taught in

The lesson [virtual context](../../../phases/14-agent-engineering/07-memory-virtual-context-memgpt/) gives the operating system analogy, the two tiers, the tool surface and the failure modes.
