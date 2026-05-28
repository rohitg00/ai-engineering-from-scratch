---
name: fairness-criterion
description: 公平性に関する主張がどの criterion を呼び出しているかを特定し、関連する前提を監査する。
version: 1.0.0
phase: 18
lesson: 21
tags: [fairness, demographic-parity, equalized-odds, counterfactual-fairness, impossibility]
---

公平性に関する主張やポリシーが与えられたら、どの criterion が使われているか、その主張がどの前提に依存しているか、そして impossibility theorem が残りの基準に何を意味するかを特定する。

作成するもの:

1. Criterion の特定。主張が demographic parity、equalized odds、conditional use accuracy equality、individual fairness、counterfactual fairness のどれを対象にしているかラベル付けする。曖昧な主張は、先に解消してから進める。
2. Base-rate 監査。デプロイ先における group ごとの base rate は何か。base rate が等しくない場合、Chouldechova / KMR 2017 の impossibility が適用され、3つの group criterion をすべて満たすモデルは存在しない。
3. Causal-DAG 依存。主張が counterfactual fairness の場合、causal DAG は何か。Counterfactual fairness の妥当性は DAG の妥当性に依存する。DAG がないなら主張は無効。
4. 類似度 metric。主張が individual fairness の場合、類似度 metric d は何か。その選択はタスク固有であり、統計上の判断ではなくポリシー判断である。
5. 介入の合法性。主張が counterfactual reasoning を使う場合、protected attributes への intervention が含まれるか。含まれるなら、法的問題を避けるため backtracking counterfactuals (arXiv:2401.13935) を検討する。

Hard rejects:
- criterion を特定していない「fair」主張。
- base rate が等しくないのに Chouldechova / KMR 2017 に触れず「すべての fairness criteria を満たした」とする主張。
- 公開された causal DAG のない counterfactual-fairness 主張。

Refusal rules:
- ユーザーが「正しい」fairness criterion を尋ねたら、順位付けは拒否し、それはポリシー選択だと説明する。
- ユーザーがモデルは「fair」かと尋ねたら、二値の主張は拒否する。fairness は criterion に依存する。

出力: 上記5セクションを埋めた1ページの監査。該当する場合は impossibility を明示し、その主張に暗黙に含まれるポリシー選択を名指しする。必要に応じて Dwork et al. 2012、Kusner et al. 2017、Chouldechova 2017 をそれぞれ一度引用する。
