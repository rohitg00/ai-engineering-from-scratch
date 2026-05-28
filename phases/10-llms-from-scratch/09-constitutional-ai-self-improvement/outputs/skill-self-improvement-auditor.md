---
name: self-improvement-auditor
description: 大規模実行前に、提案された自己改善または Constitutional AI パイプラインを監査する。
version: 1.0.0
phase: 10
lesson: 9
tags: [alignment, cai, grpo, rlhf, self-improvement, reward-hacking]
---

Constitutional AI、RLAIF、GRPO、または self-generated preference data のいずれかを使うと主張する training pipeline が提案されたら、次の内容を含む監査を作成する。

1. Reward rule。正確な verifier (regex, sympy, test suite, LLM judge) を明記する。deterministic、stochastic-LLM、hybrid のいずれかに分類する。external grounding を持たない「self-improvement」ループは拒否する。モデルは無から signal を引き出せない。
2. Group statistics。GRPO pipelines では、group size、advantages の計算方法 (z-score か relative rank か)、group reward std が 0 に崩れたときの処理を確認する。pipeline は zero-variance groups を skip または downweight すべきであり、epsilon で割って signal が実在するふりをしてはならない。
3. KL budget。実行全体での cumulative KL(policy || reference) に対する数値上限を置く。cap に達したら pipeline は停止、reset、またはより warm な reference への切り替えをしなければならない。無制限の KL は無制限の drift である。
4. Diversity floor。タスクが許す範囲で、per-group reward std、response length variance、または n-gram entropy の測定された下限を置く。floor を N consecutive rounds 下回った場合、pipeline は fresh human data またはより広い prompt distribution を混ぜなければならない。
5. Human data quota。training mix に残す human-authored data の最小割合を定める。通常は 5-10%。self-distillation-only pipelines は 3-5 rounds 後に崩れる。これを明示的に指摘する。
6. Mode-collapse watchdog。自動チェックを flag する: rounds をまたぐ reward std、held-out prompts 上の unique n-gram count、length distribution、refusal rate。いずれかが threshold を越えたら training を停止する。
7. Constitution drift。CAI pipelines では、versioned constitution file、changelog、「constitutional regression test set」を要求する。これは編集をまたいでも expected behavior が変わってはならない prompts である。

次の pipelines は承認を拒否する。
- external verifier (rule, tool, environment) なしに「zero human data」を主張する。
- process-reward hacking probe なしで PRMs を使う。モデルが証明を進めずに正しそうに見える steps を書いていないか確認する必要がある。
- held-out diversity benchmark なしに rejection-sampling fine-tuning を 5 rounds 超実行する。
- reference model を policy と共有する。reference がなければ KL がなく、anchor もない。
- policy と同じモデルの LLM judge で採点する。judge contamination にあたる。

出力: 1 ページの audit。各 gate について pass/fail、測定または申告された値、その signal を生成する pipeline 内の正確な step を示す。いずれかの gate が fail した場合、pass に変えるための minimum viable change を列挙する。
