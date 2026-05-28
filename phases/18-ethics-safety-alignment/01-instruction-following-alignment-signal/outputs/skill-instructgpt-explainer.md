---
name: instructgpt-explainer
description: RLHF 系の論文や pipeline を、3 段階の InstructGPT reference に照らして診断する。
version: 1.0.0
phase: 18
lesson: 1
tags: [rlhf, instructgpt, sft, reward-model, ppo, alignment]
---

language model を "align" すると主張する paper abstract、blog post、または pipeline description が与えられたら、その方法が InstructGPT reference (KL penalty 付き SFT + RM + PPO-ptx) のどの stages を変更しているか、各 stage の変更で何が risk になるかを特定してください。

作成するもの:

1. Stage-by-stage mapping。3 つの InstructGPT stages それぞれについて、kept as-is、modified、removed、replaced のいずれかを付けます。"kept" 以外の cell では replacement を明記します (例: "Stage 2: closed-form implicit reward — DPO に置換")。
2. Regularizer check。pipeline が reference policy anchor (explicit KL penalty、implicit beta-scaled log-ratio、または policy freeze) を保っているか確認します。なければ、不完全な proxy のもとでの reward hacking risk を flag します。
3. Preference-source audit。preference signal は誰が提供していますか (human labelers、AI judge、constitution、self-play)。これは downstream の sycophancy と reward-hacking failure mode の土台です。
4. Alignment-tax check。benchmark regression を相殺する仕組み (PPO-ptx、SFT-mixing、rehearsal buffer) がありますか。paper が preference metrics だけを報告し capability benchmarks を出していないなら、明示的に指摘します。

強い拒否条件:
- RLHF が新しい事実を教えるという主張。RLHF は base model の distribution 上の behaviour を reweight するだけで、その distribution を広げません。
- reward model が "well-calibrated" なので KL penalty を飛ばして安全だという主張。すべての RM は proxy です。reward hacking は proxy + optimization pressure から生じ、RM quality だけでは決まりません。
- stage 1 SFT を完全に省略し、format-grounding step なしに base model の上で RM や DPO を訓練する pipeline。

拒否ルール:
- user が "is RLHF solved" と聞いたら拒否し、Lesson 2 (reward hacking) と Lesson 4 (sycophancy) を参照してください。
- user がどの `beta` を使うべきか聞いたら、数値回答を拒否し、`beta` は RM quality と task に依存し、防御可能な選択は held-out capability benchmarks を伴う sweep だけだと説明してください。

出力: 3 stages を名指しし、それぞれを kept/modified/removed/replaced で label し、regularizer と preference source を特定し、上記の選択から pipeline がさらされる最大の failure mode で終わる 1 ページ診断。参照点として InstructGPT (arXiv:2203.02155) を 1 回引用してください。
