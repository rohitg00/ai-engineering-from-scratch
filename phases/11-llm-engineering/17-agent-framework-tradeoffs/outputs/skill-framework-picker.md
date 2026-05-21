---
name: framework-picker
description: Pick LangGraph, CrewAI, AutoGen, Agno, or plain Python for an agent task by matching abstraction to problem shape.
version: 1.0.0
phase: 11
lesson: 17
tags: [langgraph, crewai, autogen, agno, agent-framework, orchestration, decision-matrix]
---

Given the task description (problem shape, total LLM calls per run, branching pattern, durability and resume needs, human-in-the-loop checkpoints, parallel fanout, session memory, expected daily run volume), output:

1. Shape match. One sentence naming the abstraction that fits: graph (typed state, named transitions), org chart (specialist roles, manager-routed handoffs), chat (agents talk until done), single agent with tools. If you cannot pick one, the task is not agent-shaped yet; stop and decompose.
2. Branching authority. Who picks the next step: developer (explicit edges), manager LLM (CrewAI hierarchical), conversational emergent (AutoGen GroupChat), tool-call self-routed (Agno). Cite the per-turn token cost of LLM-selected routing if applicable.
3. State budget. Confirm whether resume-after-restart, time-travel, or human interrupts are required. If yes, LangGraph wins on state-first abstractions; Agno covers session-scoped memory only.
4. Framework choice. Output one of langgraph, crewai, autogen, agno, plain_python. Include the one-sentence justification that maps the shape and state answers onto the framework's core primitive.
5. Escape hatch. If the daily run volume is over 10_000 or the task is two or fewer LLM calls without state, recommend plain Python with the provider SDK instead. No framework is the fastest framework when the task is small.

Refuse to recommend AutoGen for deterministic workflows with a known DAG; the GroupChatManager spends tokens picking speakers that the developer could have wired statically. Refuse CrewAI when the roles need to hand structured state between tasks; the context field is string-typed and quietly drops fields. Refuse LangGraph for a two-call summarizer; the StateGraph overhead is pure tax. Refuse Agno when the task fans out across more than 4 parallel sub-workers with reducer semantics; Send is LangGraph's primitive, not Agno's.

Example input: "Long-running research workflow: plan, fan out to three retrievers, synthesize, human approves brief, write report, cite sources. Must resume after crash. Production-bound to 50 runs per day."

Example output:
- Shape: graph. Typed plan, three parallel retrievers, named transitions between synthesize and write.
- Branching: developer-decided via conditional edges. No per-turn manager LLM.
- State: requires resume and human interrupt. LangGraph mandatory.
- Framework: langgraph. State, Send fanout, interrupt_before, and PostgresSaver are all first-class.
- Escape hatch: not applicable. 50 runs per day is well below the plain-Python threshold and the workflow is too stateful to leave unframeworked.
