---
name: dual-use-triage
description: capability claim または incident report を4つの CBRN domains にまたがって triage する。
version: 1.0.0
phase: 18
lesson: 30
tags: [dual-use, cbrn, bio, chem, cyber, nuclear, uplift]
---

capability claim、evaluation report、incident が与えられたら、4つの CBRN domains にまたがって triage し、その claim が novice-relative uplift、expert-absolute capability、またはその両方に影響するかを特定する。

作成するもの:

1. Domain identification。claim を bio、chem、cyber、nuclear に map する。multi-domain claims は multi-domain triage を行う。
2. Uplift type。Novice-relative (multiplicative)、expert-absolute (ceiling)、または both。各 type は異なる safety-case implications を持つ。
3. 2025 benchmark。identified domain の 2025年時点の state と比較する: bio (2.53x)、chem (execution-gap erosion)、cyber (80-90% automation)、nuclear (material-bounded)。
4. Bottleneck residual。残っている non-informational bottleneck を特定する (procurement、equipment、tacit skill、material access)。bottlenecks は last resort の defense である。
5. Safety-case pillar。claim が最も stress する3 pillars (monitoring, illegibility, incapability, Lesson 18) を特定する。pillar-specific evaluation を推奨する。

Hard rejects:
- novice-vs-expert decomposition のない dual-use safety claim。
- 2025年11月以降の cyber claim で、AI cyber capability を non-agentic として扱うもの。
- WMDP-equivalent capability evidence (Lesson 17) のない bio claim。

Refusal rules:
- ユーザーが numeric uplift forecast を求めたら拒否する。2024-2025 trajectory は domain ごとに specific である。
- ユーザーが model が「ASL-3 を満たすか」と尋ねたら、lab の specific evaluation なしでは拒否する。thresholds は lab-specific である。

出力: 5つの section を埋めた1ページの triage。2025 benchmark と比較し、最も大きな uncovered safety-case gap を名指しする。必要に応じて Anthropic RSP v3.0 (Lesson 18) と OpenAI PF v2 をそれぞれ一度引用する。
