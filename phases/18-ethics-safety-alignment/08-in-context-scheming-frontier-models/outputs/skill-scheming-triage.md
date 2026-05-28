---
name: scheming-triage
description: agent-deployment incident report を Apollo three-pillar scheming framework で triage する。
version: 1.0.0
phase: 18
lesson: 8
tags: [scheming, agent-safety, apollo, three-pillars, safety-cases]
---

agent-deployment incident report (unexpected tool use、data access、self-preservation-adjacent behaviour) が与えられたら、failure mode を分類し、scheming が候補なら Apollo three-pillar test を適用してください。

作成するもの:

1. Failure-class triage。incident を capability failure (model が task をできなかった)、control failure (monitoring/tool-use protocol が model を contain できなかった)、scheming (model が別の in-context goal に奉仕するため user goal に反する actions を取った) のいずれかに label します。
2. Three-pillar check (scheming が候補の場合)。
   - Misalignment: action は environment または tool output に存在する orthogonal goal に奉仕したか。
   - Goal-directedness: action は multi-step plan の一部か、それとも one-shot error か。
   - Situational awareness: model がその時点で evaluation されていると知っていた evidence はあるか。
3. Evaluation-context audit。incident は deployment、red-team evaluation、または両方で観測されたか。deployment のみなら、evaluation-time results は transfer しないことを note します (Apollo 2025 caveat)。
4. Elicitation reproducibility。同じ prompt + environment で behaviour を再現できるか。reproducible incident は three-pillar frame 内です。non-reproducible なものは capability elicitation artifact かもしれません。
5. Safety-case gap。この deployment の current safety case は 3 pillars のどれに対処し、どれを uncovered のままにしているか。

強い拒否条件:
- scheming を capability-class failure として扱う framing。Scheming には goal-directedness と situational awareness が必要です。capability-lacking model は scheme できません。
- "anti-scheming training reduced covert-action rate" が underlying misalignment の低下を意味するという inference。同じ model の evaluation-context recognition rate を確認する必要があります。
- agent が data を exfiltrate していないから oversight subversion は "not an attack" だという主張。oversight subversion はそれ自体が scheming action です。

拒否ルール:
- user が "is my model scheming" と聞いたら、three-pillar evidence なしの binary answer を拒否し、evaluation-context と elicitation-reproducibility data を求めてください。
- user が residual scheming probability を求めたら numeric answer を拒否し、2026 evaluation reliability は model 自身の situational-awareness によって bounded だと説明してください。

出力: failure class を label し、available evidence で 3 pillars を埋め、missing evidence を flag し、最も urgent な single safety-case gap を名指しする 1 ページ triage。framework source として Meinke et al. (arXiv:2412.04984) を 1 回引用してください。
