---
name: case-study-mapper
description: 提案された multi-agent system design を、最も近い 2026 production reference（Anthropic Research、MetaGPT/ChatDev、OpenClaw/Moltbook）に map する。既知の trade-offs、recommended framework、本番で検証済みの specific design decisions を示す。
version: 1.0.0
phase: 16
lesson: 25
tags: [multi-agent, case-studies, production, framework-selection, reference-architectures]
---

提案された multi-agent system design が与えられたら、最も近い canonical 2026 case study を選び、適応する。

作成するもの:

1. **Design fingerprint。** Task type（research / engineering / population / automation）、agent count、verification requirement、runtime duration、role distinctness、user-facing network exposure。
2. **Closest case study。**
   - **Anthropic Research**: research または knowledge-retrieval task、verification mandatory、multi-hour runs、agents が主に context と scope で異なる（fresh-context subagents が勝つ）場合。
   - **MetaGPT / ChatDev**: engineering または structured workflow、roles が明確に区別できる（planner / coder / reviewer / tester）、handoff artifacts が well-typed な場合。
   - **OpenClaw / Moltbook**: population-scale、user-facing agent network、prompt-injection が意味のある threat、emergent economy が重要な場合。
3. **Patterns to copy。** 選んだ case study から適用できる specific design decisions: fresh-context subagents、rainbow deploy、communicative dehallucination、DAG routing、unwritable verifier、substrate-level security。
4. **Framework recommendation。** LangGraph、CrewAI、AG2、Microsoft Agent Framework、OpenAI Agents SDK、Google ADK、Anthropic Claude Agent SDK、または custom。case study の typical framework を default とし、specific design により良い fit があれば note する。
5. **Anti-patterns from the case。** reference case でうまくいかなかったこと。new design では避ける。
6. **Cost projection。** expected token multiplier（Anthropic Research: ~15x、MetaGPT: ~5x、OpenClaw: network effects に依存）。expected wall-clock and dollar cost range。
7. **Evaluation approach。** 関連する benchmark（MARBLE、SWE-bench Pro、internal）。case-study baseline に対して目標とする delta はどの程度が妥当か。

Hard rejects:

- correctness requirements がある task で verification を無視する design。すべての case study は verification tax を払っている。
- attack surface として prompt-injection を認めずに new substrate を主張する design。OpenClaw/Moltbook case は、これが hypothetical ではなく production concern であることを示している。
- どの case study にも map しない「revolutionary」claim。multi-agent は 2024 年から production に入っているため、novel claims には explicit comparison が必要。
- justification なしに MCP または A2A adoption を省く design。protocol support は table stakes。

Refusal rules:

- design に clear task type がない場合、case study を選ぶ前に task scoping を推奨する。「Multi-agent for everything」は design ではない。
- design が production readiness を主張しているが failure-mode audit がない場合、reference mapping の前に MAST-style audit（Lesson 23）を推奨する。
- design が purely experimental / research なら、case study の production patterns を採用する前に hardening が必要な点を note する。

Output: 2 ページの brief。1 文の summary（「Closest case study: MetaGPT / ChatDev. Adopt role-SOP decomposition, communicative dehallucination, and structured handoff artifacts; use CrewAI or custom.」）から始め、その後に上記 7 sections を続ける。最後に 90-day adaptation plan（reference から copy するもの、customize するもの、benchmark で validate するもの）を書く。
