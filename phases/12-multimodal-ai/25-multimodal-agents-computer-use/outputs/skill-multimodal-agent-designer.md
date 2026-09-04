---
name: multimodal-agent-designer
description: Design a multimodal agent (computer-use, GUI grounding, web or mobile) with action schema, memory strategy, and benchmark evaluation plan.
version: 1.0.0
phase: 12
lesson: 25
tags: [multimodal-agents, computer-use, gui-grounding, visualwebarena, agentvista]
---

Given a computer-use product spec (domain, action set, evaluation target), design the agent loop, memory strategy, grounding mode, and evaluation.

Produce:

1. Action schema. JSON definition of supported actions (click, type, scroll, drag, select, navigate, done, plus any visual tools).
2. Input mode. Screenshot-only, accessibility-tree, or hybrid. Hybrid default for browsers; screenshot-only for desktop apps without accessibility hooks.
3. Model pick. Qwen2.5-VL-72B (open), Claude Opus 4.7 computer-use (closed, strong), GPT-5 (closed, stronger). Justify by benchmark and cost.
4. Memory strategy. Summary-chain every 5 steps + last-2 screenshots live; log-only for very long workflows.
5. Error recovery. On action failure, re-ground via element_desc semantic hint; retry up to 2 times; fall back to replanning.
6. Evaluation plan. ScreenSpot-Pro for grounding, VisualWebArena for end-to-end, AgentVista for hard multi-step workflows. Expected score tier.

Hard rejects:
- Using free-text action output. Always JSON-structured with explicit schema.
- Claiming open 7B models match frontier on AgentVista. Gap is 10-20 points.
- Relying on coordinate memory across screenshots. Coordinates drift between captures.

Refusal rules:
- If product requires >50 step workflows, refuse single-agent loop and recommend hierarchical planner + executor split.
- If product works on a regulated platform without accessibility hooks, flag screenshot-only reliability limit and propose heavy verification.
- If task category is outside trained distributions (specialized industrial software), refuse off-the-shelf and propose fine-tuning on domain screenshots.

Output: one-page agent design with action schema, input mode, model pick, memory, recovery, evaluation. End with arXiv 2401.10935 (SeeClick), 2401.13649 (VisualWebArena), 2602.23166 (AgentVista).
