# Group Chat and Speaker Selection

> AutoGen GroupChat and AG2 GroupChat share one conversation across N agents; a selector function (LLM, round-robin, or custom) picks who speaks next. This is the archetype of emergent multi-agent conversation — agents do not know their role in a static graph, they just react to the shared pool. AutoGen v0.2's GroupChat semantics were preserved in the AG2 fork; AutoGen v0.4 rewrote it as an event-driven actor model. Microsoft put AutoGen into maintenance mode in February 2026 and merged it with Semantic Kernel into Microsoft Agent Framework (RC February 2026). The GroupChat primitive survives in both AG2 and Microsoft Agent Framework — learn it once, use it everywhere.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problem

Static graphs (LangGraph) are great when the workflow is known. Real conversations are not static: sometimes the coder asks the reviewer, sometimes the researcher, sometimes the writer. Hardcoding every possible handoff produces an edge explosion. You want *agents reacting to a shared pool*, with some function deciding who talks next.

That is exactly what AutoGen GroupChat does.

## Concept

### The shape

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Every agent sees every message. A selector function is invoked at each turn to pick who speaks next.

### The three selector flavors

**Round-robin.** Fixed cycle. Deterministic. Scales linearly in N but ignores context — a coder gets the turn even when the topic is legal review.

**LLM-selected.** A call to an LLM that reads the recent pool and returns the best next speaker. Context-aware but slow: every turn adds an LLM call. AutoGen's default.

**Custom.** A Python function with whatever logic you want. Typical: LLM-selected with fallback rules (e.g., "always give the verifier the turn after the coder").

### The ConversableAgent API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` holds the selector. When an agent completes a turn, the manager calls the selector, which returns the next agent. Loop continues until a termination condition.

### Termination

Three common patterns:

- **Max rounds.** Hard cap on total turns.
- **"TERMINATE" token.** Agents can emit a sentinel message; the manager stops when one appears.
- **Goal-reached check.** A lightweight verifier runs each turn and stops the chat when done.

### The AutoGen → AG2 split and the Microsoft Agent Framework merge

In early 2025, Microsoft began a major rewrite of AutoGen (v0.4) around an event-driven actor model. The community forked AutoGen v0.2's GroupChat semantics as AG2, preserving the API that early adopters had integrated.

In February 2026, Microsoft announced AutoGen would go to maintenance mode, with the event-driven actor model merging into **Microsoft Agent Framework** (RC February 2026, now merged with Semantic Kernel). The GroupChat concept survives in both tracks; the implementation details differ. AG2 is the preferred upstream for v0.2-compatible code.

### When GroupChat fits

- **Emergent conversations.** You do not want to pre-wire every possible next-speaker.
- **Role-mixing tasks.** Coder asks researcher, researcher asks archivist, archivist asks coder back. Flow is not a DAG.
- **Exploratory problem-solving.** Think "brainstorm meeting," not "assembly line."

### When it fails

- **Strict determinism.** The LLM selector can be inconsistent. Same prompt, different runs, different next speakers.
- **Sycophancy cascades.** Agents defer to whoever spoke most confidently. Counter-prompt explicitly.
- **Context bloat.** Every agent reads every message; after 10 turns the context is huge. Use projections (Lesson 15) to scope views.
- **Hot speakers.** One agent dominates the conversation because the selector favors its specialties. Introduce speaker balance as a selector feature.

### Group chat vs supervisor

Same primitives, different defaults:

- Supervisor: one agent plans and others execute. Selector is "ask the planner what to do."
- Group chat: all agents are peers; selector is a function over the shared pool.

Both use the four primitives from Lesson 04. Group chat defaults to LLM-selected orchestration and full-pool shared state.

## Build It

`code/main.py` implements a GroupChat from scratch in stdlib. Three agents (coder, reviewer, manager), round-robin and LLM-selected variants, and a termination on a `TERMINATE` token.

The demo prints the conversation transcript plus the selector's decision trace for both variants.

Run:

```
python3 code/main.py
```

## Use It

`outputs/skill-groupchat-selector.md` configures a GroupChat selector for a given task — round-robin vs LLM-selected vs custom, and what selector inputs (recent messages, agent specialties, turn counts) to use.

## Ship It

Checklist:

- **Max rounds cap.** Always. 10-20 for typical tasks.
- **Speaker-balance metric.** Track turns per agent; alert when imbalance exceeds a threshold.
- **Termination token.** `TERMINATE` or a dedicated verifier agent.
- **Projection or scoped memory.** After ~10 messages, consider giving each agent only a scoped view to prevent context bloat.
- **Selector logging.** For LLM-selected variants, log both the selector's input and its choice. Otherwise debugging is impossible.

## Exercises

1. Run `code/main.py`. Compare the conversation under round-robin vs LLM-selected. Which agent dominates under each?
2. Add a "max-speaks-per-agent" rule in the selector. How does it affect the transcript?
3. Implement a goal-reached termination: stop when the reviewer returns "approved." How often does it trigger before the round cap?
4. Read the AutoGen stable docs on GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html). Identify the default selector used by `GroupChatManager`.
5. Read the AG2 repo (https://github.com/ag2ai/ag2) and compare its v0.2 GroupChat to the v0.4 event-driven version. What concrete property (throughput, fault-tolerance, composability) does v0.4 add?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Further Reading

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — the reference implementation
- [AG2 repo](https://github.com/ag2ai/ag2) — community AutoGen v0.2 continuation
- [Microsoft Agent Framework docs](https://microsoft.github.io/agent-framework/) — the merged successor, RC February 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) — event-driven actor model rewrite details
