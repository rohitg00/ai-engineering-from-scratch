---
id: lost-in-the-middle-order
title: Where each part of the context goes, and why
card: prompting-structured-output
kind: concept
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [context-engineering, lost-in-the-middle, token-budget, ordering]
minutes: 8
lessons: [phases/11-llm-engineering/05-context-engineering]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/tool-budget-fifty-tools, prompting-structured-output/timestamp-kills-the-cache]
updated: 2026-11-03
---

You assemble a prompt from a system message, ten retrieved documents, the chat history so far and the user question. In which order do you place them, and what evidence decides it?

## Short answer

Put the system prompt and the critical instructions first, the current question and the most relevant context last, and the lowest-priority material in the middle. The evidence is the lost-in-the-middle finding: with one relevant document among 20, accuracy was 85 to 90 percent when it sat first or last and fell to 60 to 70 percent in the middle. If a key point has to sit in the middle, repeat it at the end.

## Full answer

### The finding

Models attend best to the start and the end of the context. The study placed one relevant document among 20 irrelevant ones and moved it. First or last, 85 to 90 percent accuracy. In the middle, 60 to 70 percent. The lesson generalizes it as a 10 to 20 percent drop for information at 40 to 70 percent of the way through the context.

### The budget

| Component | Typical size |
|---|---|
| System prompt | about 500 tokens |
| Tool definitions | 2K to 8K tokens |
| Retrieved context | 2K to 10K tokens |
| Conversation history | 2K to 20K tokens |
| Few-shot examples | 1K to 3K tokens |
| User query | 100 to 500 tokens |
| Generation reserve | 2K to 8K tokens |

Every token in the window displaces a token that could carry more signal. A 10K prompt that is 90 percent signal beats a 100K prompt that is 10 percent signal.

### Do not include all ten documents

Bad retrieval is worse than none; it fills the window with noise and misleads the model. Score each document against the query and drop those below a threshold. If you retrieved 10 chunks and 3 are relevant, keep the 3.

### The reorder

The lesson's function sorts the documents by score, sends the odd ranks to the front in order and the even ranks to the back in reverse, so the best sit at both ends and the weakest in the middle. Then the history, compressed into a summary when it passes a threshold, then the question last, with 2,000 to 4,000 tokens reserved for the answer.

## Follow-ups

- **Level 2:** Why not include all ten retrieved documents? Expected: bad retrieval is worse than none; score each against the query, drop those below a threshold, and keep the 3 relevant ones over 10 mediocre ones.
- **Level 2:** What do you reserve at the end of the window, and how much? Expected: the generation budget, at least 2,000 to 4,000 tokens, or the model has no room to answer.
- **Level 3:** How does the lesson's reorder place five scored documents? Expected: sorted by score, the odd ranks go to the front in order and the even ranks go to the back in reverse, so the best sit at both ends.
- **Level 3:** The same system prompt is sent on every turn. What does that imply for its size? Expected: every word is paid on every call, so keep it tight; the lesson cites a coding assistant with about 6,000 tokens of system prompt and tool definitions.

## Wrong answers

- "The window is huge, more context is always better." A 10K prompt that is 90 percent signal beats a 100K prompt that is 10 percent signal; more context is more noise for attention to filter.
- "Put the question first so the model knows what to look for." The end of the context gets high attention too; the lesson places the current query last and the instructions first.
- "Order does not matter, attention sees everything." The measured drop in the middle is 10 to 20 percent.

## Taught in

The lesson [context engineering](../../../phases/11-llm-engineering/05-context-engineering/) gives the lost-in-the-middle numbers, the budget table and the reorder function.
