---
name: search-policy
description: task shape、token budget、evaluator qualityに基づいてsearch strategy（ReAct、ToT、LATS、evolutionary）を選ぶ。
version: 1.0.0
phase: 14
lesson: 04
tags: [tree-of-thoughts, lats, mcts, search, value-function]
---

task shape（single-answer / multi-answer / open-ended）、token budget、available evaluator（scalar test / heuristic / self-eval）が与えられたら、具体的なparameters付きのsearch strategy recommendationを生成する。

生成するもの:

1. Decision。linear ReAct、beam ToT（beam width k付き）、BFS ToT（max depth付き）、pruning付きDFS ToT、MCTS LATS（iterationsとUCT c付き）、evolutionary search（evaluatorがprogrammaticかつcheckableな場合のみ）のいずれか。
2. Parameters。各strategyについて具体的なnumeric defaultsを出す。beam width、depth cap、branching factor K、levelごとのrollouts、UCT c（default 1.4）、timeout。
3. Value function。nodeを何でscoreするかを厳密に指定する。選択肢はunit-test pass rate、targetまでのnumeric distance、format付きprompted LLM score（sure/likely/impossible、1..10、またはvote）、environment reward。
4. Token budget estimate。worst-case tokens = branching_factor ^ depth * avg_prompt_tokens。数値を示す。user budgetを超える場合は安いstrategyを推奨する。
5. Failure modes。選んだstrategyごとにtop-two failure modesとmitigationsを列挙する（例: LATS + noisy evaluator -> CRITICによるtool-grounded verificationを追加、レッスン05）。

強い却下条件:

- evaluatorが信頼できない（self-evalのみ、ground truthなし）のにsearchを推奨すること。ReAct + CRITICへfallbackする。
- compelling reasonなしにbranching factor Kを5より大きく設定すること。K=3〜5がpaper defaultであり、K=10はcostを爆発させる。
- chat-style taskへLATSを適用すること。programmatic targetのないconversational Q&Aではsearchは役に立たない。
- machine-checkable fitnessなしのevolutionary search。AlphaEvolveが面白いのは、fitnessがprogrammatic（testsを実行、speedを測定、theoremをverify）だからである。

拒否ルール:

- token budgetがsingle-trajectory costの5倍未満なら、searchを拒否し、ReAct + Reflexion（レッスン03）を推奨する。
- wall-clock latency budgetが10秒未満なら、LATSを拒否し、ReActを推奨する。
- taskがpure information retrievalなら、searchを拒否し、ReWOO（レッスン02）を推奨する。

出力: recommendation block（chosen strategy、parameters、value function、budget estimate）と、evaluator reliabilityにはレッスン05（CRITIC）、evolutionary variantsにはレッスン11（AlphaEvolve）、benchmark-grade validationにはレッスン30（eval-driven development）を指す「次に読むもの」note。
