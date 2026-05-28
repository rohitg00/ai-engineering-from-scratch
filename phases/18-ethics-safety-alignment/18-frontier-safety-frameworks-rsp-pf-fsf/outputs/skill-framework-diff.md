---
name: framework-diff
description: 新しい safety framework または release note を RSP v3.0、PF v2、FSF v3.0 と比較する。
version: 1.0.0
phase: 18
lesson: 18
tags: [rsp, pf, fsf, frontier-safety, safety-case]
---

新しい safety framework、policy、release note が与えられたら、Anthropic RSP v3.0、OpenAI PF v2、DeepMind FSF v3.0 と5つの structural axes で比較する。

生成する内容:

1. Tier structure。framework は discrete capability thresholds を定義しているか。per-domain (FSF-style) か global (RSP-style) か。
2. CBRN threshold。どの CBRN evaluation が required か。WMDP (Lesson 17) または同等のものを参照しているか。elicitation study を含むか。
3. AI R&D threshold。model-autonomous-research threshold はあるか。bar は "entry-level researcher" (Anthropic AI R&D-2) か "substantially accelerate scaling" (Anthropic AI R&D-4) か。
4. Competitor-adjustment。competitors が comparable safeguards なしで ship した場合に requirements を下げられるか。文脈に応じて race-dynamic または incentive-compatibility として framing する。
5. Safety-case structure。written safety case は required か。monitoring、illegibility、incapability のどれを target にしているか。evidence bar は何か。

強い却下条件:
- per-tier capability thresholds のない safety framework。
- external governance cross-reference (UK AISI、US CAISI、EU AI Office) を省く framework。
- specific threshold numbers なしに「we align with all published frameworks」と主張する framework。

拒否ルール:
- ユーザーがどの framework が「best」か尋ねたら、ranking を拒否し、structural alignment を示す。
- ユーザーが numeric threshold recommendation を求めたら拒否する。thresholds は lab-specific であり、measurement infrastructure に依存する。

出力: 3つの frameworks との1ページ side-by-side comparison、flagged gaps、追加すべき specific threshold recommendation を1つ。RSP v3.0、PF v2、FSF v3.0 をそれぞれ1回引用する。
