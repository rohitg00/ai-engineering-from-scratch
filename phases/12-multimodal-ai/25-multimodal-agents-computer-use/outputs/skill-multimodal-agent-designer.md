---
name: multimodal-agent-designer
description: action schema、memory strategy、benchmark evaluation plan を含む multimodal agent (computer-use、GUI grounding、web/mobile) を設計する。
version: 1.0.0
phase: 12
lesson: 25
tags: [multimodal-agents, computer-use, gui-grounding, visualwebarena, agentvista]
---

computer-use product spec（domain、action set、evaluation target）が与えられたら、agent loop、memory strategy、grounding mode、evaluationを設計する。

出力するもの:

1. Action schema。supported actions (click、type、scroll、drag、select、navigate、done、任意の visual tools) の JSON definition。
2. Input mode。screenshot-only、accessibility-tree、または hybrid。browser は hybrid default。accessibility hooks がない desktop apps は screenshot-only。
3. Model pick。Qwen2.5-VL-72B (open)、Claude Opus 4.7 computer-use (closed、strong)、GPT-5 (closed、stronger)。benchmark と cost で正当化する。
4. Memory strategy。5 steps ごとの summary-chain + last-2 screenshots live。非常に長い workflow は log-only。
5. Error recovery。action failure 時は element_desc semantic hint で re-ground し、最大 2 回 retry し、最後は replanning。
6. Evaluation plan。grounding は ScreenSpot-Pro、end-to-end は VisualWebArena、hard multi-step workflows は AgentVista。expected score tier も示す。

Hard rejects:
- free-text action output を使うこと。必ず explicit schema 付きの JSON-structured output にする。
- open 7B models が AgentVista で frontier に並ぶと主張すること。差は 10-20 points ある。
- screenshots 間で coordinate memory に依存すること。captures の間に coordinates は drift する。

Refusal rules:
- product が >50 step workflows を必要とする場合は single-agent loop を拒否し、hierarchical planner + executor split を推奨する。
- product が accessibility hooks なしの regulated platform 上で動く場合は screenshot-only の reliability limit を明示し、heavy verification を提案する。
- task category が trained distributions の外 (specialized industrial software など) の場合は off-the-shelf を拒否し、domain screenshots での fine-tuning を提案する。

Output: action schema、input mode、model pick、memory、recovery、evaluationを含む1-page agent design。最後にarXiv 2401.10935 (SeeClick)、2401.13649 (VisualWebArena)、2602.23166 (AgentVista)を添える。
