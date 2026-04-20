---
name: skill-context-engineering
description: Decision framework for designing context assembly pipelines based on task type, window size, and latency budget
version: 1.0.0
phase: 11
lesson: 05
tags: [context-engineering, context-window, rag, memory, tool-selection, lost-in-the-middle]
---

# Context Engineering

When building an LLM application, apply this framework to design the context assembly pipeline.

## Core principles

1. **Context is scarce.** A 128K window sounds large but fills fast. Budget every component explicitly.
2. **Attention is uneven.** Models attend more to the start and end. Put critical information there. The middle is the dead zone.
3. **Dynamic beats static.** Different queries need different context. Assemble per query, not once at startup.
4. **Less is more.** A curated 10K context outperforms a dumped 100K context. Signal-to-noise ratio matters more than total information.
5. **Measure everything.** You cannot optimize what you do not measure. Count tokens per component on every request.

## Context budget guidelines

| Component | Typical Range | Priority | Compression Strategy |
|-----------|-------------|----------|---------------------|
| System prompt | 200-1,000 tokens | Fixed, high | Write tight, remove redundancy |
| Tool definitions | 500-3,000 tokens | Dynamic, medium | Prune by query intent |
| Retrieved context | 1,000-5,000 tokens | Dynamic, high | Rerank + threshold + deduplicate |
| Conversation history | 500-5,000 tokens | Dynamic, medium | Summarize old turns |
| Few-shot examples | 500-2,000 tokens | Dynamic, high | Select by task similarity |
| User query | 50-500 tokens | Fixed, highest | N/A |
| Generation reserve | 2,000-8,000 tokens | Fixed | Adjust by expected output length |

## When to use each memory type

**Short-term (conversation history):** The current session. Managed by summarization. Compress turns older than 5-10 exchanges. Keep the last 3-4 turns verbatim.

**Long-term (facts database):** Preferences and project facts that persist across sessions. Retrieve on session start. Examples: "user prefers Python", "project uses PostgreSQL", "team follows trunk-based development". Store in CLAUDE.md, a database, or a structured memory system.

**Episodic (past interactions):** Specific past conversations relevant to the current task. Store as embeddings, retrieve by similarity. "Last week we debugged a similar auth issue" is episodic memory.

## Tool selection strategy

Do not include all tools in every request. This wastes tokens and confuses the model.

1. Classify the query intent (code, email, calendar, research, data)
2. Map intents to tool categories
3. Include only matching tools
4. If intent is ambiguous, include tools from the top 2 categories
5. Always include a "general" tool (like web search) as fallback

Expected savings: 60-80% of tool definition tokens on queries with clear intent.

## Retrieval best practices

- **Rerank after retrieval.** Vector similarity is a rough filter. A reranker (cross-encoder or LLM-based) improves precision significantly.
- **Set a relevance threshold.** Do not include chunks below 0.3 cosine similarity. They add noise.
- **Deduplicate.** If two chunks share 80%+ content, keep only the higher-scored one.
- **Apply lost-in-the-middle ordering.** Place the most relevant chunks first and last.
- **Limit total retrieval tokens.** 3-5 highly relevant chunks beat 15 mediocre ones.

## History management

- Keep the last 3-4 turns verbatim (the model needs recent context)
- Summarize older turns into a digest ("We discussed X, decided Y, and blocked on Z")
- Drop system-generated turns that add no information (tool invocations with no user-facing content)
- Trigger compression when history exceeds 30% of the available budget

## Red flags

- System prompt exceeds 2,000 tokens: probably includes information that should be dynamic
- All tools included on every request: implement intent-based selection
- No relevance filtering on retrieval: you are dumping noise into the window
- History grows unbounded: summarization is not implemented
- No generation reserve: the model truncates its responses
- Same information in 3 places (system prompt, retrieved doc, history): deduplicate
- Context utilization over 60%: you are leaving too little room for the model to "think"
