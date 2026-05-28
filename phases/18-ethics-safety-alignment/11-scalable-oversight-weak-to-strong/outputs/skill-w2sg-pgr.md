---
name: w2sg-pgr
description: performance-gap-recovered 指標で scalable-oversight または W2SG の主張を監査する。
version: 1.0.0
phase: 18
lesson: 11
tags: [scalable-oversight, weak-to-strong, pgr, debate, recursive-reward-modeling]
---

scalable-oversight または W2SG の論文 / レポートが与えられたら、その設定が主張を支えているか監査する。

生成する内容:

1. Weak / strong の特定。弱い監督者と強いモデルを明示的に名前で示す。capability gap は parameters、training tokens、benchmark score、task-specific evaluation のどれで測られているか。
2. Ceiling の定義。そのタスクにおける強いモデルの supervised ceiling は何か。ceiling がなければ PGR は計算できない。
3. PGR 計算。PGR = (fine-tuned - weak) / (ceiling - weak)。符号、大きさ、分母を確認する。分母が小さいと PGR は人工的に膨らむ。
4. Prior-leakage チェック。強いモデルの pre-training data に、そのタスクの ground truth が含まれていないか。含まれる場合、「recovery」は generalization ではなく prior retrieval かもしれない。
5. Alignment-vs-capability の分離。weak-to-strong gap は capability gap か alignment gap か。Burns et al. 2023 は、彼らの gap が capability-shaped であることを明示している。alignment-shaped gap は異なる挙動を示す可能性がある。

scalable-oversight mechanism を監査する場合:
- Debate: judge の知識、debater 構造、タスクが truth-leaning を報いるかを特定する。debate が有効な場合と失敗する場合について Khan et al. 2024 (arXiv:2402.06782) を引用する。
- RRM: recursion depth と、U+1 がすでに信用できない場合に何が起きるかを特定する。
- Task decomposition: 分解手順と、sub-task が独立に確認可能かを特定する。

強い却下条件:
- gold labels 上の ceiling なしの PGR 主張。
- alignment を解決したと主張する W2SG 主張。W2SG が測るのは capability recovery であり、alignment ではない。
- debate がいつ有効でいつ悪化させるかについての 2024 年の経験的文献を無視する debate-mechanism 主張。

拒否ルール:
- ユーザーが「W2SG は superalignment を解決するか」と尋ねたら、二択回答を拒否し、PGR は測定可能な量であり解ではないと説明する。
- ユーザーが最良の scalable-oversight mechanism を尋ねたら、拒否する。答えはタスク依存である。

出力: 上記5セクションを埋め、PGR を報告または要求し、weak-strong gap が capability-shaped か alignment-shaped かを示す1ページの監査。Burns et al. 2023 と Lang et al. (arXiv:2501.13124) をそれぞれ1回ずつ引用する。
