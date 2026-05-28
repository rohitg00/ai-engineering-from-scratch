# Capstone Lesson 40: Direct Preference Optimization from Scratch

> DPO は reward model と PPO を使わず、preference pair から policy を直接 fitting する supervised loss です。

**種別:** Build
**言語:** Python (torch, numpy)
**前提条件:** Phase 19 lessons 30-37
**所要時間:** 約90分

## 学習目標
- DPO loss を log-ratio difference 上の sigmoid として導出する。
- frozen reference model と trainable policy model のペアを作る。
- prompt token を mask し、completion token の sequence log-probability を計算する。
- `(prompt, chosen, rejected)` triple で policy を学習し、chosen の log-prob が rejected より高くなることを確認する。
- loss math、gradient direction、reference invariance をテストで固定する。

## DPO の考え方
Bradley-Terry model では、人間が chosen `y_w` を rejected `y_l` より好む確率は `sigmoid(r(x,y_w) - r(x,y_l))` です。RLHF は reward model を明示的に学習して PPO で policy を最適化します。DPO は最適 policy の閉形式から reward 差を log-ratio で表し、reward model を消します。

```text
L_DPO = -log sigmoid(beta * ((log pi_theta(y_w|x) - log pi_ref(y_w|x))
                             - (log pi_theta(y_l|x) - log pi_ref(y_l|x))))
```

この式は各例につき4つの log-probability だけで計算できます。reference は SFT model の凍結コピーで、policy はそこから開始して更新されます。

## gradient の向き
`log pi_theta(y_w|x)` に対する勾配は負なので、chosen completion の log-prob を上げると loss は下がります。`log pi_theta(y_l|x)` に対する勾配は正なので、rejected の log-prob は下げられます。reference は frozen で動きません。

## 実装
`InstructionTokenizer`、`TinyGPT`、`make_preferences`、`sequence_log_prob`、`dpo_loss`、`train_dpo`、`evaluate_margins`、`run_demo` を実装します。デモは小さな reference/policy を作り、DPO 学習で chosen-rejected margin が増えることを表示します。
