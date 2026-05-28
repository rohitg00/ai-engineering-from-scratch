---
name: refine-loop
description: task、verifier availability、iteration budgetに基づいてevaluator-optimizer（Self-Refine / CRITIC）loopを設定する。
version: 1.0.0
phase: 14
lesson: 05
tags: [self-refine, critic, evaluator-optimizer, guardrails, iteration]
---

task、iteration budget、利用可能なverifier（tool-groundedまたはself-eval only）が与えられたら、evaluator-optimizer loop用のpromptsとstop policyを出力する。

生成するもの:

1. Generator prompt。first outputを作るdeterministic producer。task、output format、constraintsを明示する。
2. Evaluator/verifier prompt。tools（search、code run、tests、calculator、type check）が利用可能なら、それらをどう呼び、structured critique（JSON with: pass/fail、violations[]、suggested_fixes[]）をどう生成するか指定する。self-evalしかない場合はSelf-Refineのrubber-stamp riskを明示し、構造的に異なるprompt style（例: adversarialに「少なくとも1つflawを見つける」）を使う。
3. Refiner prompt。prior outputsとcritiques（history）を参照しなければならない。「prior iterationsでflagされたfailure modeを繰り返さない」ことを必須と明記する。
4. Stop policy。結合条件: verifier passes OR（self-eval says fine AND iterations >= 2）OR iterations >= max_iterations。単一条件にしない。
5. Observability hooks。全refine trajectoryをauditできるよう、各iterationをOpenTelemetry GenAI span（evaluate、optimize）としてlogする（レッスン23）。

強い却下条件:

- generatorとcriticに同じpromptを使うこと。rubber-stamp riskがある。modelが自分に同意してしまう。
- iteration capがないこと。無限refine loopはtokensを燃やす。defaultで必ず4にcapする。
- verifier promptがfreeform prose feedbackを求めること。structured JSONのみ。pass/failとitemized violationsを返す。
- refiner promptからhistoryを落とすこと。論文はhistoryなしでqualityが崩れることを示している。

拒否ルール:

- taskにverifierがなく、作る方法もない場合、CRITICを拒否し、Self-Refineが利用可能な弱いoptionだと述べる。rubber-stamp riskをuserに警告する。
- max_iterations >= 10の場合は拒否し、taskの再設計を推奨する。3〜4 passesを超えるrefine-to-convergenceは通常、generator promptが間違っているsignである。
- verifierがdestructive tools（shell、git write）を呼ぶ場合は拒否し、sandbox boundary（レッスン09）を要求する。

出力: すべてのprompts、stop policy、tool listを含む単一configuration blockと、deployment targetに応じてレッスン16（OpenAI Agents SDK guardrails）、レッスン12（Anthropic evaluator-optimizer）、またはレッスン30（eval-driven agent development）を指す「次に読むもの」note。
